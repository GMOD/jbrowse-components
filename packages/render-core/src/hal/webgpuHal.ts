/// <reference types="@webgpu/types" />

import { syncCanvasSize } from '../canvas2dUtils.ts'
import {
  canvasConfiguredBy,
  canvasContextError,
  noteCanvasConfigured,
  noteCanvasContext,
} from '../canvasContext.ts'
import { getGpuDevice } from '../gpuDevice.ts'
import {
  STANDARD_BLEND_STATE,
  createUniformOnlyBindGroup,
  createVertexBuffer,
  toGpuVertexFormat,
} from '../webgpuUtils.ts'
import { getDeviceLayouts, getOrBuildPipeline } from './deviceGpuCache.ts'
import { OomReporter } from './oomReporter.ts'
import { RegionRegistry } from './regionRegistry.ts'

import type { DeviceLayouts } from './deviceGpuCache.ts'
import type { BlendState, GpuHal, PipelineDescriptor } from './types.ts'

class ShaderCompileError extends Error {
  constructor(passId: string, details: string) {
    super(`WGSL compile error in pass "${passId}": ${details}`)
    this.name = 'ShaderCompileError'
  }
}

// Maximum number of writeUniforms() calls per frame. Each call occupies one
// aligned slot in the uniform ring buffer.
//
// The ring is allocated eagerly at this many slots, as a GPU buffer AND a CPU
// staging array, whether a renderer writes 4 slots or 1900 — so the cost is
// per display and is the aligned uniform size that decides it, not the slot
// count. A display whose uniform fits the 256-byte minimum alignment pays
// 512 KB each side; alignments' 864-byte uniform aligns to 1024, so 2 MiB each
// side. Trivial once, per-track at ten open alignments tracks.
//
// Exhausting it does not throw: the write is dropped and its draws render
// against the previous batch's uniforms, which is wrong data rather than stale
// data. If we ever hit the cap, switch to a dynamic-growth buffer (recreate
// buffer + every region's bind group) rather than just bumping the constant
// again.
const MAX_UNIFORM_SLOTS = 2048

// Warn while there is still headroom, because the cap itself is not a place to
// find out. A renderer's per-frame write count is rarely one number: alignments
// writes once per stacked section per block, plus one per section with an arc
// band, so a grouped view multiplies it by up to MAX_GROUPS (40) and a
// multi-region view by the block count again. The headroom is real but it is not
// the "~50 writes/frame" this file used to claim, and nothing reported the
// difference between 50 and 1900.
const UNIFORM_SLOT_WARN_AT = MAX_UNIFORM_SLOTS / 2
// Set to 1 to disable MSAA (e.g. to debug Firefox compositor stalls).
// All render-pass, texture, and pipeline setup is conditioned on this value,
// so changing it will not cause a mismatch.
const MSAA_SAMPLE_COUNT: 1 | 4 = 4

function gpuBlendState(bs: BlendState): GPUBlendState {
  // Max ignores its factors, but WebGPU still validates them and rejects
  // anything but 'one' on both channels ("Destination blend factor ... is
  // defined and not BlendFactor::One when blend operation is
  // BlendOperation::Max"). Same blend as webgl2Hal's bare glBlendEquation(MAX).
  const max = { srcFactor: 'one', dstFactor: 'one', operation: 'max' } as const
  // Otherwise RGB uses the caller-supplied factors and alpha always accumulates
  // through ONE / ONE_MINUS_SRC_ALPHA (matches webgl2Hal.applyBlendState).
  return bs.op === 'max'
    ? { color: max, alpha: max }
    : {
        color: { srcFactor: bs.srcFactor, dstFactor: bs.dstFactor },
        alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
      }
}

// One entry per (region, pass). `dataBuffer` is the vertex buffer bound via
// setVertexBuffer(0, ...). Bind groups are NOT stored here — they belong to the
// pass being drawn, not to the buffer being drawn from (see `getBindGroup`).
interface RegionPassBuffer {
  dataBuffer: GPUBuffer
  count: number
}

// Every pass reads per-instance data from a vertex buffer (no storage binding
// at 0) because Slang-generated shaders cross-compile to GLSL ES, which has no
// SSBOs. The two @group(0) layouts a pass is built against — uniform-only, and
// uniform + texture + sampler — belong to the device, not to this HAL, and live
// in `deviceGpuCache.ts` with the pipelines.

async function buildPipeline(
  device: GPUDevice,
  desc: PipelineDescriptor,
  layouts: DeviceLayouts,
) {
  const module = device.createShaderModule({ code: desc.wgslSource })
  const info = await module.getCompilationInfo()
  const errors = info.messages.filter(m => m.type === 'error')
  if (errors.length > 0) {
    const details = errors
      .map(m => `line ${m.lineNum}: ${m.message}`)
      .join('; ')
    throw new ShaderCompileError(desc.id, details)
  }
  const blend = desc.blend
    ? desc.blendState
      ? gpuBlendState(desc.blendState)
      : STANDARD_BLEND_STATE
    : undefined

  // Every pass feeds @location(N) inputs from a bound vertex buffer.
  const vertexBuffers: GPUVertexBufferLayout[] = [
    {
      arrayStride: desc.instanceStride,
      stepMode: 'instance',
      attributes: desc.vertexAttributes.map((attr, i) => ({
        shaderLocation: i,
        offset: attr.offsetBytes,
        format: toGpuVertexFormat(attr),
      })),
    },
  ]

  return device.createRenderPipelineAsync({
    layout: desc.textures?.length
      ? layouts.texturedPipelineLayout
      : layouts.uniformOnlyPipelineLayout,
    vertex: { module, entryPoint: 'vs_main', buffers: vertexBuffers },
    fragment: {
      module,
      entryPoint: desc.wgslFragmentEntry ?? 'fs_main',
      targets: [
        {
          format: navigator.gpu.getPreferredCanvasFormat(),
          ...(blend && { blend }),
        },
      ],
    },
    primitive: { topology: desc.topology ?? 'triangle-list' },
    multisample:
      MSAA_SAMPLE_COUNT === 1 ? undefined : { count: MSAA_SAMPLE_COUNT },
  })
}

// Resolve every declared pass to its pipeline, taking the device-wide cache's
// answer wherever another display of this type already built one. Still every
// pass up front rather than on first draw — the WebGL2 side compiles lazily
// (`getPass`) and this side does not; see ARCHITECTURAL_LIMITS.md §"Every
// WebGPU display resolves its whole pass list before it can paint".
async function resolvePipelines(
  device: GPUDevice,
  descriptors: PipelineDescriptor[],
) {
  const built = await Promise.all(
    descriptors.map(desc =>
      getOrBuildPipeline(device, desc, layouts =>
        buildPipeline(device, desc, layouts),
      ),
    ),
  )
  return new Map(descriptors.map((desc, i) => [desc.id, built[i]!]))
}

interface PassTextureState {
  texture: GPUTexture
  sampler: GPUSampler
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

// Behavioral parity with WebGL2Hal is enforced by tests, not by this file:
// products/jbrowse-web/browser-tests/compare-backends.ts pixel-diffs webgl vs
// webgpu vs canvas2d output, and shared buffer bookkeeping is covered by
// hal/regionRegistry.test.ts. Neither HAL is where attribute layout is checked —
// `assertVertexInputsMatch` does that at `pnpm gen:shaders` time, per shader and
// per target. Mirror any behavior change in webgl2Hal.ts.
export class WebGPUHal implements GpuHal {
  private device: GPUDevice
  private canvas: HTMLCanvasElement
  private context: GPUCanvasContext
  private regions: RegionRegistry<RegionPassBuffer>
  private descriptors: Map<string, PipelineDescriptor>
  private pipelines: ReadonlyMap<string, GPURenderPipeline>
  private passTextures = new Map<string, PassTextureState>()
  // One bind group per textured pass, built lazily by `getBindGroup` and
  // dropped when `uploadTexture` swaps that pass's texture. Uniform-only passes
  // are not stored here — they all share `uniformOnlyBindGroup`.
  private passBindGroups = new Map<string, GPUBindGroup>()
  // The device's layouts, not this HAL's — shared with every other display on
  // the same device. The bind GROUPS above stay per-HAL: they reference this
  // HAL's uniform ring buffer.
  private layouts: DeviceLayouts

  // Uniform ring buffer: holds up to MAX_UNIFORM_SLOTS sets of uniforms so
  // that all draw calls in a frame can reference different uniform data via
  // dynamic offsets, enabling a single command encoder + submit per frame.
  private alignedUniformSize: number
  private uniformRingBuffer: GPUBuffer
  private uniformStaging: Uint8Array
  private uniformSlot = 0
  // Once per HAL, not once per frame: at 60fps a per-frame warning is a
  // console the developer stops reading, and the fact is about the renderer
  // rather than about this frame.
  private warnedUniformSlots = false

  // Shared bind group for every uniform-only pass — only references
  // `uniformRingBuffer` (via dynamic offset at draw time), so one instance
  // serves all passes/regions instead of allocating a fresh one per upload.
  private uniformOnlyBindGroup: GPUBindGroup

  // MSAA resolve texture — 4x multisampled render target
  private msaaTexture: GPUTexture | null = null
  private msaaView: GPUTextureView | null = null

  // Frame state — single render pass batches all draws per frame so MSAA
  // resolves only once, eliminating artifacts from intermediate resolves.
  private currentTextureView: GPUTextureView | null = null
  private currentEncoder: GPUCommandEncoder | null = null
  private currentPass: GPURenderPassEncoder | null = null

  // Scissor/viewport state (physical pixels, top-left origin). `null` means the
  // full attachment, which is both the caller's "cleared" state and a render
  // pass's own initial one.
  private scissorRect: Rect | null = null
  private viewportRect: Rect | null = null
  // What the open render pass was last told, so `drawPass` re-issues only on a
  // change. Seeded in `beginFrame` with the full rect the pass already starts
  // at, which keeps the common path (one scissor per block, no clears) at
  // exactly the calls it made before. Mutated rather than replaced — these are
  // touched once per draw call, and a draw call is not a place to allocate.
  private appliedScissor: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private appliedViewport: Rect = { x: 0, y: 0, w: 0, h: 0 }

  // Guards dispose() against double invocation (pagehide + React cleanup can
  // both fire).
  private disposed = false

  // One-shot flags for `acquireTextureView`: the warn fires once per HAL rather
  // than once per frame, and a reconfigure that failed is not attempted again.
  private warnedSwapChainLoss = false
  private swapChainUnrecoverable = false

  private oom = new OomReporter('WebGPUHal')

  private constructor(
    device: GPUDevice,
    canvas: HTMLCanvasElement,
    context: GPUCanvasContext,
    descriptors: PipelineDescriptor[],
    uniformByteSize: number,
    pipelines: Map<string, GPURenderPipeline>,
    layouts: DeviceLayouts,
  ) {
    this.device = device
    this.canvas = canvas
    this.context = context
    this.descriptors = new Map(descriptors.map(d => [d.id, d]))
    this.pipelines = pipelines
    this.layouts = layouts

    // Align uniform slots to device requirements for dynamic offsets
    const alignment = device.limits.minUniformBufferOffsetAlignment
    this.alignedUniformSize = Math.ceil(uniformByteSize / alignment) * alignment

    const ringSize = MAX_UNIFORM_SLOTS * this.alignedUniformSize
    this.uniformRingBuffer = device.createBuffer({
      size: ringSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    this.uniformStaging = new Uint8Array(ringSize)
    this.uniformOnlyBindGroup = createUniformOnlyBindGroup(
      device,
      layouts.uniformOnlyBindGroupLayout,
      this.uniformRingBuffer,
      this.alignedUniformSize,
    )
    this.regions = new RegionRegistry<RegionPassBuffer>(buf => {
      buf.dataBuffer.destroy()
    })
    this.configureContext()
  }

  /**
   * Claim the canvas's swap chain, and record that this HAL is the one holding
   * it — see `noteCanvasConfigured` for why that ownership has to be tracked.
   *
   * Called from the constructor rather than from `create`, so that the object
   * doing the claiming exists, and so a throwing constructor leaves no
   * configured context behind with nothing to release it.
   */
  private configureContext() {
    this.context.configure({
      device: this.device,
      format: navigator.gpu.getPreferredCanvasFormat(),
      alphaMode: 'premultiplied',
    })
    noteCanvasConfigured(this.canvas, this)
  }

  static async create(
    canvas: HTMLCanvasElement,
    descriptors: PipelineDescriptor[],
    uniformByteSize: number,
  ) {
    const device = await getGpuDevice()
    if (!device) {
      return null
    }
    // Resolve pipelines BEFORE acquiring the canvas's webgpu context. A canvas's
    // context type is permanent once acquired, so if shader compilation throws
    // here the canvas stays pristine and createGpuHal's WebGL2 fallback can
    // still claim it — otherwise a partial WebGPU init would drop us all the way
    // to Canvas2D on a WebGL2-capable machine.
    const layouts = getDeviceLayouts(device)
    const pipelines = await resolvePipelines(device, descriptors)
    const context = canvas.getContext('webgpu')
    if (!context) {
      // Returning null (rather than throwing) keeps the ladder running, so this
      // is the one rung whose reason would otherwise be console-only. It is
      // recorded as the rung's failure so `createGpuHal` can attach it to
      // whatever the ladder eventually fails with.
      throw canvasContextError(canvas, 'webgpu')
    }
    noteCanvasContext(canvas, 'webgpu')
    return new WebGPUHal(
      device,
      canvas,
      context,
      descriptors,
      uniformByteSize,
      pipelines,
      layouts,
    )
  }

  resize(width: number, height: number) {
    const { changed, scale } = syncCanvasSize(this.canvas, width, height)
    if (changed || !this.msaaTexture) {
      this.recreateMsaaTexture(this.canvas.width, this.canvas.height)
    }
    return scale
  }

  private recreateMsaaTexture(width: number, height: number) {
    this.msaaTexture?.destroy()
    this.msaaTexture = null
    this.msaaView = null
    const maxDim = this.device.limits.maxTextureDimension2D
    if (width > maxDim || height > maxDim) {
      this.oom.report(
        `This view is too large for this GPU — zoom in or reduce the track height. (canvas ${width}×${height} exceeds max texture size ${maxDim})`,
      )
      return
    }
    if (MSAA_SAMPLE_COUNT > 1 && width > 0 && height > 0) {
      this.msaaTexture = this.device.createTexture({
        size: [width, height],
        format: navigator.gpu.getPreferredCanvasFormat(),
        sampleCount: MSAA_SAMPLE_COUNT,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      })
      this.msaaView = this.msaaTexture.createView()
    }
  }

  setErrorHandler(handler: (error: Error) => void) {
    this.oom.setHandler(handler)
  }

  uploadBuffer(
    regionKey: number,
    passId: string,
    data: ArrayBuffer | ArrayBufferView,
    count: number,
  ) {
    this.regions.deleteBuffer(regionKey, passId)
    if (count === 0) {
      return
    }
    const { maxBufferSize } = this.device.limits
    if (data.byteLength > maxBufferSize) {
      this.oom.report(
        `This region has too much data to render on this GPU — zoom in. (vertex buffer ${data.byteLength} bytes exceeds device limit ${maxBufferSize})`,
      )
      return
    }
    const dataBuffer = createVertexBuffer(this.device, data)
    this.regions.set(regionKey, passId, { dataBuffer, count })
  }

  /**
   * Bind group matching the pipeline layout of `passId`.
   *
   * Keyed on the pass being DRAWN, never on the buffer it draws from:
   * `drawPass(a, key, b)` runs pass `a`'s pipeline over pass `b`'s vertex
   * buffer, so the bind group has to match `a`'s layout. Caching it on the
   * (region, `b`) buffer entry instead bound `b`'s layout to `a`'s pipeline —
   * fine while every such pair happened to be uniform-only, a validation error
   * (and a dropped draw) the moment one side samples a texture.
   *
   * Nothing in a bind group varies per region either: it references the
   * HAL-wide uniform ring buffer plus the pass's own texture/sampler. So
   * uniform-only passes all share `uniformOnlyBindGroup`, and a textured pass
   * gets exactly one, cached until `uploadTexture` replaces its texture.
   * Returns undefined when a pass needs a texture that hasn't arrived yet;
   * drawPass skips those.
   */
  private getBindGroup(passId: string): GPUBindGroup | undefined {
    const tb = this.descriptors.get(passId)?.textures?.[0]
    if (tb) {
      let bindGroup = this.passBindGroups.get(passId)
      if (!bindGroup) {
        const texState = this.passTextures.get(passId)
        if (texState) {
          bindGroup = this.device.createBindGroup({
            layout: this.layouts.texturedBindGroupLayout,
            entries: [
              {
                binding: 1,
                resource: {
                  buffer: this.uniformRingBuffer,
                  offset: 0,
                  size: this.alignedUniformSize,
                },
              },
              {
                binding: tb.textureBinding,
                resource: texState.texture.createView(),
              },
              { binding: tb.samplerBinding, resource: texState.sampler },
            ],
          })
          this.passBindGroups.set(passId, bindGroup)
        }
      }
      return bindGroup
    }
    return this.uniformOnlyBindGroup
  }

  getBufferCount(regionKey: number, passId: string) {
    return this.regions.get(regionKey, passId)?.count ?? 0
  }

  // Mid-frame destroy of buffers referenced by an in-flight render pass is a
  // bug — warn but proceed (the registry destroy lands either way).
  private warnIfMidFrame(label: string) {
    if (this.currentEncoder) {
      console.warn(
        `[WebGPUHal] ${label} called mid-frame — in-flight render passes may reference these buffers`,
      )
    }
  }

  deleteBuffer(regionKey: number, passId: string) {
    this.warnIfMidFrame(`deleteBuffer(${regionKey}, ${passId})`)
    this.regions.deleteBuffer(regionKey, passId)
  }

  deleteRegion(regionKey: number) {
    this.warnIfMidFrame(`deleteRegion(${regionKey})`)
    this.regions.deleteRegion(regionKey)
  }

  pruneRegions(active: Iterable<number>) {
    this.warnIfMidFrame('pruneRegions')
    this.regions.prune(active)
  }

  uploadTexture(
    passId: string,
    data: Uint8Array,
    width: number,
    height: number,
  ) {
    const desc = this.descriptors.get(passId)
    const tb = desc?.textures?.[0]
    if (!tb) {
      return
    }
    const maxDim = this.device.limits.maxTextureDimension2D
    if (width > maxDim || height > maxDim) {
      this.oom.report(
        `This region is too large to render on this GPU — zoom in. (texture ${width}×${height} exceeds max texture size ${maxDim})`,
      )
      return
    }
    const existing = this.passTextures.get(passId)
    if (existing) {
      existing.texture.destroy()
    }
    const texture = this.device.createTexture({
      size: [width, height],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    })
    this.device.queue.writeTexture(
      { texture },
      data,
      { bytesPerRow: width * 4 },
      { width, height },
    )
    const sampler = this.device.createSampler({
      magFilter: tb.filter,
      minFilter: tb.filter,
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    })
    this.passTextures.set(passId, { texture, sampler })

    // Drop the cached bind group so the next draw rebuilds it against the new
    // texture (and so a pass drawn before its first texture arrived stops
    // being skipped).
    this.passBindGroups.delete(passId)
  }

  writeUniforms(data: ArrayBuffer) {
    if (this.currentEncoder) {
      // Inside a frame: stage data at the current slot for batched upload
      if (this.uniformSlot >= MAX_UNIFORM_SLOTS) {
        console.error(
          `[WebGPUHal] uniform ring buffer exhausted at ${MAX_UNIFORM_SLOTS} ` +
            `writeUniforms calls in one frame — this write is dropped, so the ` +
            `paired draw renders with the previous batch's uniforms (wrong ` +
            `data, not last-frame-stale). This indicates a renderer doing far ` +
            `more per-frame uniform writes than expected; investigate the call ` +
            `site before raising the cap (and consider switching to a ` +
            `dynamic-growth ring buffer).`,
        )
        return
      }
      const offset = this.uniformSlot * this.alignedUniformSize
      this.uniformStaging.set(new Uint8Array(data), offset)
      this.uniformSlot++
    } else {
      // No active frame (currentEncoder is null). Every renderer writes
      // uniforms strictly between beginFrame and endFrame, so the only way to
      // land here is when beginFrame early-returned on a zero-size canvas
      // (it skips creating the encoder and resetting uniformSlot). The paired
      // drawPass/endFrame also no-op on that path, so this write never reaches
      // the screen — but writing to slot 0 and marking it used keeps the ring
      // state coherent rather than appending to a stale uniformSlot. Defensive,
      // not a real render path.
      this.device.queue.writeBuffer(this.uniformRingBuffer, 0, data)
      this.uniformSlot = 1
    }
  }

  /**
   * The canvas texture to draw this frame into, or null when the swap chain is
   * gone and could not be rebuilt.
   *
   * **A configuration can disappear under a live HAL.** The case we have seen is
   * a sibling HAL on a reused canvas element releasing a context it turned out
   * not to own (`noteCanvasConfigured` has the shape), and a browser is free to
   * drop one for its own reasons too. Firefox reports it as `InvalidStateError:
   * GPUCanvasContext.getCurrentTexture: Canvas not configured` — on this call
   * and, measured, on no other. Nothing else in the stack hears about it: there
   * is no context-lost event to fire the recovery in `useRenderingBackend`, so
   * unguarded the throw leaves `RenderLifecycleMixin`'s render autorun, lands in
   * `renderError`, and the display banners a raw DOMException until the tab is
   * reloaded.
   *
   * Reconfiguring restores it in full, so this frame goes on to paint. A
   * reconfigure that does *not* restore it is reported and not retried — every
   * later frame would rebuild a swap chain to no effect, and the display's own
   * Retry is what builds a fresh HAL.
   */
  private acquireTextureView() {
    try {
      return this.context.getCurrentTexture().createView()
    } catch (e) {
      if (this.swapChainUnrecoverable) {
        return null
      }
      if (!this.warnedSwapChainLoss) {
        this.warnedSwapChainLoss = true
        console.warn(`[WebGPUHal] canvas lost its swap chain, rebuilding: ${e}`)
      }
      try {
        this.configureContext()
        return this.context.getCurrentTexture().createView()
      } catch (retryError) {
        this.swapChainUnrecoverable = true
        this.oom.report(
          `This canvas lost its GPU swap chain and could not reclaim one, so it cannot draw. Retry to rebuild the renderer. (${retryError})`,
        )
        return null
      }
    }
  }

  beginFrame(clearR: number, clearG: number, clearB: number, clearA = 1) {
    // Skip the frame entirely rather than encode one that cannot be valid.
    // Zero-size canvas: nothing to draw. Missing MSAA target while MSAA is
    // configured: every pipeline was built with `multisample.count = 4`, so the
    // single-sample fallback attachment below would mismatch and every draw in
    // the frame would be rejected. That happens after `recreateMsaaTexture`
    // bails on an over-`maxTextureDimension2D` canvas — it has already reported
    // through `oom`, so the user has the real message and there is nothing to
    // gain from also spraying validation errors each frame.
    if (
      this.disposed ||
      this.canvas.width === 0 ||
      this.canvas.height === 0 ||
      (MSAA_SAMPLE_COUNT > 1 && !this.msaaView)
    ) {
      return
    }
    // Before the error scopes, so a failed acquisition needs no unwinding: the
    // scopes stay pushed iff an encoder is created, which is what endFrame's
    // early-return on !currentEncoder is paired with.
    const textureView = this.acquireTextureView()
    if (!textureView) {
      return
    }
    this.device.pushErrorScope('validation')
    this.device.pushErrorScope('out-of-memory')
    this.scissorRect = null
    this.viewportRect = null
    this.seedApplied(this.appliedScissor)
    this.seedApplied(this.appliedViewport)
    this.currentTextureView = textureView
    this.currentEncoder = this.device.createCommandEncoder()
    this.uniformSlot = 0

    // With MSAA: render to the multisampled texture, then resolve to the canvas
    // texture. Without MSAA (MSAA_SAMPLE_COUNT === 1, so `msaaView` is never
    // built): render directly to the canvas texture. The guard above is what
    // keeps those the only two cases — a null `msaaView` while MSAA is on never
    // reaches here.
    const clearValue = { r: clearR, g: clearG, b: clearB, a: clearA }
    this.currentPass = this.currentEncoder.beginRenderPass({
      colorAttachments: [
        this.msaaView
          ? {
              view: this.msaaView,
              resolveTarget: this.currentTextureView,
              loadOp: 'clear',
              storeOp: 'discard',
              clearValue,
            }
          : {
              view: this.currentTextureView,
              loadOp: 'clear',
              storeOp: 'store',
              clearValue,
            },
      ],
    })
  }

  drawPass(passId: string, regionKey: number, bufferPassId?: string) {
    if (!this.currentPass) {
      return
    }
    const pipeline = this.pipelines.get(passId)
    if (!pipeline) {
      return
    }
    const regionBuf = this.regions.get(regionKey, bufferPassId ?? passId)
    if (!regionBuf || regionBuf.count === 0) {
      return
    }

    const desc = this.descriptors.get(passId)
    if (!desc) {
      return
    }

    const bindGroup = this.getBindGroup(passId)
    if (!bindGroup) {
      return
    }

    // uniformSlot is post-incremented in writeUniforms, so slot (uniformSlot-1)
    // holds the uniforms written for THIS draw call. Multiple drawPass calls
    // between writeUniforms calls intentionally share the same slot.
    //
    // Edge case: if drawPass is called before any writeUniforms in this frame
    // (uniformSlot === 0), Math.max clamps the offset to 0 so we never index
    // slot -1. Every renderer pairs writeUniforms with its draws, so this
    // clamp is purely defensive — the clamped draw reads whatever slot 0 last
    // held, which is acceptable only because no renderer relies on it.
    const dynamicOffset =
      Math.max(0, this.uniformSlot - 1) * this.alignedUniformSize

    this.applyViewport(this.currentPass)
    this.applyScissor(this.currentPass)
    this.currentPass.setPipeline(pipeline)
    this.currentPass.setBindGroup(0, bindGroup, [dynamicOffset])
    this.currentPass.setVertexBuffer(0, regionBuf.dataBuffer)
    this.currentPass.draw(desc.verticesPerInstance, regionBuf.count)
  }

  endFrame() {
    if (!this.currentEncoder) {
      return
    }

    if (this.currentPass) {
      this.currentPass.end()
      this.currentPass = null
    }

    if (this.uniformSlot > 0) {
      const uploadSize = this.uniformSlot * this.alignedUniformSize
      this.device.queue.writeBuffer(
        this.uniformRingBuffer,
        0,
        this.uniformStaging,
        0,
        uploadSize,
      )
    }
    if (this.uniformSlot >= UNIFORM_SLOT_WARN_AT && !this.warnedUniformSlots) {
      this.warnedUniformSlots = true
      console.warn(
        `[WebGPUHal] this frame used ${this.uniformSlot} of ${MAX_UNIFORM_SLOTS} uniform ring slots. At the cap, writes are dropped and their draws render against another batch's uniforms — wrong pixels, no error. A count this high usually means a per-frame write inside a loop that has grown a dimension (stacked sections, displayed regions), or a write nothing draws with. Check the renderer before raising the cap.`,
      )
    }
    const slotAtSubmit = this.uniformSlot
    this.device.queue.submit([this.currentEncoder.finish()])

    // Pop the error scopes pushed in beginFrame (after the early-return guard).
    void this.device.popErrorScope().then(err => {
      if (err) {
        // Genuine VRAM exhaustion during the frame (distinct from the proactive
        // over-limit checks in uploadBuffer/uploadTexture). Surface to the
        // display, not just the console — the view is too large for this GPU.
        this.oom.report(
          `This view exhausted GPU memory — zoom in or reduce the track height. (out-of-memory after submit, slot ${slotAtSubmit}: ${err.message})`,
        )
      }
    })
    void this.device.popErrorScope().then(err => {
      if (err) {
        console.error(
          '[WebGPUHal] endFrame: VALIDATION error after submit, slot=',
          slotAtSubmit,
          err.message,
        )
      }
    })
    this.currentEncoder = null
    this.currentTextureView = null
  }

  /**
   * Mark `at` as holding the whole attachment — the state a freshly-begun
   * render pass is already in, so seeding with it means the first draw of an
   * unclipped frame issues nothing.
   */
  private seedApplied(at: Rect) {
    at.x = 0
    at.y = 0
    at.w = this.canvas.width
    at.h = this.canvas.height
  }

  /**
   * Re-issue the scissor whenever it differs from what this pass was last told,
   * **including when it has been cleared**.
   *
   * WebGL2 clears by turning the state off — `disable(SCISSOR_TEST)`, and a
   * `viewport` back to the full canvas — and that lands immediately.
   * `setScissorRect` / `setViewport` have no off switch and no reset: they are
   * render-pass state that persists to the end of the pass. So dropping the
   * stored rect on `clearScissor` is not a clear at all — it left the
   * *previous* rect clipping every later draw of the frame, while WebGL2 drew
   * those same calls unclipped.
   *
   * Nothing in tree clears mid-frame today — the two callers
   * (`GpuPerRegionRenderingBackend.renderBlocks` and alignments' own) clear
   * after their last draw — so this is parity kept ahead of the renderer that
   * needs it rather than a fix for a live bug. The bug it would have been is
   * the kind this package exists to refuse: right on Canvas2D, right on WebGL2,
   * wrong on WebGPU alone, and silent everywhere.
   */
  private applyScissor(pass: GPURenderPassEncoder) {
    const r = this.scissorRect
    const x = r ? r.x : 0
    const y = r ? r.y : 0
    const w = r ? r.w : this.canvas.width
    const h = r ? r.h : this.canvas.height
    const at = this.appliedScissor
    if (at.x !== x || at.y !== y || at.w !== w || at.h !== h) {
      pass.setScissorRect(x, y, w, h)
      at.x = x
      at.y = y
      at.w = w
      at.h = h
    }
  }

  /** The viewport half of {@link applyScissor}; same reasoning throughout. */
  private applyViewport(pass: GPURenderPassEncoder) {
    const r = this.viewportRect
    const x = r ? r.x : 0
    const y = r ? r.y : 0
    const w = r ? r.w : this.canvas.width
    const h = r ? r.h : this.canvas.height
    const at = this.appliedViewport
    if (at.x !== x || at.y !== y || at.w !== w || at.h !== h) {
      pass.setViewport(x, y, w, h, 0, 1)
      at.x = x
      at.y = y
      at.w = w
      at.h = h
    }
  }

  setScissor(x: number, y: number, w: number, h: number) {
    this.scissorRect = { x, y, w, h }
  }

  clearScissor() {
    this.scissorRect = null
  }

  setViewport(x: number, y: number, w: number, h: number) {
    this.viewportRect = { x, y, w, h }
  }

  clearViewport() {
    this.viewportRect = null
  }

  dispose() {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.warnIfMidFrame('dispose')
    this.regions.deleteAll()
    this.uniformRingBuffer.destroy()
    for (const ts of this.passTextures.values()) {
      ts.texture.destroy()
    }
    this.passTextures.clear()
    this.passBindGroups.clear()
    this.msaaTexture?.destroy()
    // Release the swapchain so the browser can reclaim GPU memory immediately
    // rather than waiting for the canvas to be GC'd — but only while it is still
    // ours to release. A `GPUCanvasContext` belongs to the element, not to the
    // HAL that configured it, so on a reused canvas this call can take a live
    // sibling's swap chain instead; `noteCanvasConfigured` has the full shape.
    if (canvasConfiguredBy(this.canvas, this)) {
      this.context.unconfigure()
    }
  }
}
