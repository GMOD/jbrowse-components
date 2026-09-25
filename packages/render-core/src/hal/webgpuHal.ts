/// <reference types="@webgpu/types" />

import { syncCanvasSize } from '../canvas2dUtils.ts'
import {
  canvasConfiguredBy,
  canvasContextError,
  noteCanvasConfigured,
  noteCanvasContext,
} from '../canvasContext.ts'
import { createGpuSurfaceLostError } from '../gpuContextLostError.ts'
import { getGpuDevice } from '../gpuDevice.ts'
import { createVertexBuffer } from '../webgpuUtils.ts'
import {
  bindGroupLayoutEntries,
  getOrBuildPipeline,
  getPassLayout,
  pipelineRecipe,
} from './deviceGpuCache.ts'
import { GpuHalBase } from './gpuHalBase.ts'

import type { PipelineRecipe } from './deviceGpuCache.ts'
import type {
  GpuHal,
  PipelineDescriptor,
  SampleCount,
  ShaderBinding,
  TextureBinding,
  TextureSource,
} from './types.ts'

class ShaderCompileError extends Error {
  constructor(passId: string, details: string) {
    super(`WGSL compile error in pass "${passId}": ${details}`)
    this.name = 'ShaderCompileError'
  }
}

// Maximum number of writeUniforms() calls per frame. Each call occupies one
// aligned slot in the uniform ring, allocated eagerly per display as a GPU
// buffer and a CPU staging array. A frame is measured using 2-4 slots, so the
// count rather than any struct is the oversized term:
// agent-docs/reference/ARCHITECTURAL_LIMITS.md §"The uniform ring is allocated
// at 2048 slots".
//
// Exhausting it does not throw: the write is dropped and its draws render
// against another batch's uniforms. If we ever hit the cap, grow the buffer and
// recreate every bind group in `passBindGroups` rather than bumping the
// constant again.
const MAX_UNIFORM_SLOTS = 2048

// Warn while there is still headroom, because the cap itself is not a place to
// find out. A renderer's per-frame write count is rarely one number: alignments
// writes once per stacked section per block, plus one per section with an arc
// band, so a grouped view multiplies it by up to MAX_GROUPS (40) and a
// multi-region view by the block count again. The headroom is real but it is not
// the "~50 writes/frame" this file used to claim, and nothing reported the
// difference between 50 and 1900.
const UNIFORM_SLOT_WARN_AT = MAX_UNIFORM_SLOTS / 2

// One entry per (region, pass). `dataBuffer` is the vertex buffer bound via
// setVertexBuffer(0, ...). Bind groups are NOT stored here — they belong to the
// pass being drawn, not to the buffer being drawn from (see `getBindGroup`).
interface RegionPassBuffer {
  dataBuffer: GPUBuffer
  count: number
}

// Every pass reads per-instance data from a vertex buffer, because Slang's
// GLSL ES target has no SSBOs.
async function buildPipeline(
  device: GPUDevice,
  recipe: PipelineRecipe,
  passId: string,
) {
  const module = device.createShaderModule({ code: recipe.wgslSource })
  const info = await module.getCompilationInfo()
  const errors = info.messages.filter(m => m.type === 'error')
  if (errors.length > 0) {
    const details = errors
      .map(m => `line ${m.lineNum}: ${m.message}`)
      .join('; ')
    throw new ShaderCompileError(passId, details)
  }
  const { blend } = recipe
  return device.createRenderPipelineAsync({
    layout: getPassLayout(device, recipe.bindGroupLayout).pipelineLayout,
    vertex: { module, entryPoint: 'vs_main', buffers: [recipe.vertexBuffer] },
    fragment: {
      module,
      entryPoint: 'fs_main',
      targets: [
        {
          format: navigator.gpu.getPreferredCanvasFormat(),
          ...(blend && { blend }),
        },
      ],
    },
    primitive: { topology: recipe.topology },
    multisample:
      recipe.sampleCount === 1 ? undefined : { count: recipe.sampleCount },
  })
}

// Every declared pass up front, unlike WebGL2's first-draw link; see
// ARCHITECTURAL_LIMITS.md §"Every WebGPU display resolves its whole pass list
// before it can paint". Each pass compiles as soon as its own WGSL arrives.
async function resolvePipelines(
  device: GPUDevice,
  descriptors: PipelineDescriptor[],
  sampleCount: SampleCount,
) {
  const built = await Promise.all(
    descriptors.map(async desc => {
      const { WGSL_SOURCE } = await desc.source.wgsl()
      return getOrBuildPipeline(
        device,
        pipelineRecipe(desc, WGSL_SOURCE, sampleCount),
        recipe => buildPipeline(device, recipe, desc.id),
      )
    }),
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
// per target. Mirror any behavior change in webgl2Hal.ts — and note that
// `GpuHalBase` already holds the parts that were only ever mirrored: the
// descriptor map, the buffer registry, both upload shells and their over-limit
// wording, and the dispose guard.
export class WebGPUHal extends GpuHalBase<RegionPassBuffer> implements GpuHal {
  private device: GPUDevice
  private canvas: HTMLCanvasElement
  private context: GPUCanvasContext
  private pipelines: ReadonlyMap<string, GPURenderPipeline>
  private passTextures = new Map<string, PassTextureState>()
  // Every pass's bind group, by the pass drawn. A pass that binds no texture
  // has one from construction, shared with each pass over the same layout; a
  // textured pass gets its own when its texture arrives, dropped when
  // `uploadTexture` replaces the texture. The layouts are the device's, shared
  // with every display on it; the groups are this HAL's, since they name its
  // uniform ring buffer.
  private passBindGroups = new Map<string, GPUBindGroup>()

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

  // Samples per pixel this display renders at, stated by whoever built it (see
  // `RenderingBackendOptions.sampleCount`). Every render-pass, texture and
  // pipeline decision below reads it, so the two shapes cannot mismatch — and
  // at 1 there is no MSAA texture at all rather than a smaller one, which is
  // the whole point of the knob.
  private sampleCount: SampleCount

  // The multisampled colour attachment, resolved into the canvas texture at the
  // end of the frame. Null for the life of the HAL when `sampleCount` is 1.
  private msaaTexture: GPUTexture | null = null
  private msaaView: GPUTextureView | null = null

  // Frame state — single render pass batches all draws per frame so MSAA
  // resolves only once, eliminating artifacts from intermediate resolves.
  private currentTextureView: GPUTextureView | null = null
  private currentEncoder: GPUCommandEncoder | null = null
  private currentPass: GPURenderPassEncoder | null = null

  /**
   * Buffers and textures whose destroy landed while the frame's render pass was
   * open, held until the frame has been submitted.
   *
   * WebGPU validates `destroy()` against the submitted command buffer, not
   * against when the draw was encoded: destroying a vertex buffer an already
   * encoded draw references makes `queue.submit` reject the whole frame, so one
   * region re-uploading a pass it drew earlier in the same frame blanks
   * everything else drawn with it. Alignments does exactly that — a chain
   * selection spanning two sections re-uploads `OVERLAY_REGION` once per
   * section, inside the block loop.
   *
   * Deferring the destroy makes mid-frame replacement legal instead of merely
   * warned about; synteny's `ensureUploaded` has always deleted a pass mid-frame
   * that the open pass never referenced, and that case was never the bug.
   */
  private pendingDestroy: { destroy: () => void }[] = []

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

  // One-shot flags for `acquireTextureView`: the warn fires once per HAL rather
  // than once per frame, and a reconfigure that failed is not attempted again.
  private warnedSwapChainLoss = false
  private swapChainUnrecoverable = false
  private reportedSurfaceFailure = false

  private constructor(
    device: GPUDevice,
    canvas: HTMLCanvasElement,
    context: GPUCanvasContext,
    descriptors: PipelineDescriptor[],
    sampleCount: SampleCount,
    pipelines: Map<string, GPURenderPipeline>,
  ) {
    super(descriptors, 'WebGPUHal')
    this.device = device
    this.canvas = canvas
    this.context = context
    this.pipelines = pipelines
    this.sampleCount = sampleCount

    // Align uniform slots to device requirements for dynamic offsets
    const alignment = device.limits.minUniformBufferOffsetAlignment
    this.alignedUniformSize =
      Math.ceil(this.uniformByteSize / alignment) * alignment

    const ringSize = MAX_UNIFORM_SLOTS * this.alignedUniformSize
    this.uniformRingBuffer = device.createBuffer({
      size: ringSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    this.uniformStaging = new Uint8Array(ringSize)
    const byLayout = new Map<GPUBindGroupLayout, GPUBindGroup>()
    for (const desc of descriptors) {
      if (!desc.bindings.some(b => b.kind === 'texture')) {
        const layout = this.bindGroupLayoutOf(desc.bindings)
        let group = byLayout.get(layout)
        if (!group) {
          group = this.createBindGroup(desc.bindings, layout)
          byLayout.set(layout, group)
        }
        this.passBindGroups.set(desc.id, group)
      }
    }
    this.configureContext()
  }

  private bindGroupLayoutOf(bindings: readonly ShaderBinding[]) {
    return getPassLayout(this.device, bindGroupLayoutEntries(bindings))
      .bindGroupLayout
  }

  // One entry per binding in the pass's table, the same table its layout was
  // built from, so the group cannot name a binding the layout lacks.
  private createBindGroup(
    bindings: readonly ShaderBinding[],
    layout: GPUBindGroupLayout,
    texture?: PassTextureState,
  ) {
    return this.device.createBindGroup({
      layout,
      entries: bindings.map(b => ({
        binding: b.index,
        resource: this.bindingResource(b, texture),
      })),
    })
  }

  private bindingResource(
    b: ShaderBinding,
    texture: PassTextureState | undefined,
  ): GPUBindingResource {
    if (b.kind === 'uniform') {
      return {
        buffer: this.uniformRingBuffer,
        offset: 0,
        size: this.alignedUniformSize,
      }
    }
    if (texture && b.kind === 'texture') {
      return texture.texture.createView()
    }
    if (texture && b.kind === 'sampler') {
      return texture.sampler
    }
    throw new Error(
      `[WebGPUHal] nothing to bind for the ${b.kind} '${b.name}' at binding ${b.index}`,
    )
  }

  protected limits() {
    const { maxBufferSize, maxTextureDimension2D } = this.device.limits
    return {
      maxBufferBytes: maxBufferSize,
      maxTextureDimensionPx: maxTextureDimension2D,
    }
  }

  protected createBuffer(data: ArrayBuffer | ArrayBufferView, count: number) {
    return { dataBuffer: createVertexBuffer(this.device, data), count }
  }

  protected destroyBuffer(buf: RegionPassBuffer) {
    this.destroyWhenIdle(buf.dataBuffer)
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
    sampleCount: SampleCount,
  ) {
    const device = await getGpuDevice()
    if (!device) {
      return null
    }
    // Resolve pipelines BEFORE acquiring the canvas's webgpu context. A canvas's
    // context type is permanent once acquired, so if a shader fails to load or
    // compile here the canvas stays pristine and createGpuHal's WebGL2 fallback
    // can still claim it — otherwise a partial WebGPU init would drop us all the
    // way to Canvas2D on a WebGL2-capable machine.
    const pipelines = await resolvePipelines(device, descriptors, sampleCount)
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
      sampleCount,
      pipelines,
    )
  }

  resize(width: number, height: number) {
    const { changed, scale } = syncCanvasSize(this.canvas, width, height)
    // `!this.msaaTexture` covers the first frame and a rebuild that bailed. At
    // sampleCount 1 there is never a texture, so without the count in the
    // condition that clause would be true on every frame and re-run the
    // over-limit check for a texture nobody is building.
    if (changed || (this.sampleCount > 1 && !this.msaaTexture)) {
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
    if (this.sampleCount > 1 && width > 0 && height > 0) {
      this.msaaTexture = this.device.createTexture({
        size: [width, height],
        format: navigator.gpu.getPreferredCanvasFormat(),
        sampleCount: this.sampleCount,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      })
      this.msaaView = this.msaaTexture.createView()
    }
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
   * HAL-wide uniform ring buffer plus the pass's own texture/sampler. Returns
   * undefined when a pass needs a texture that hasn't arrived yet; drawPass
   * skips those.
   */
  private getBindGroup(passId: string): GPUBindGroup | undefined {
    return this.passBindGroups.get(passId) ?? this.bindTexture(passId)
  }

  private bindTexture(passId: string) {
    const texture = this.passTextures.get(passId)
    const desc = this.descriptors.get(passId)
    if (!texture || !desc) {
      return undefined
    }
    const group = this.createBindGroup(
      desc.bindings,
      this.bindGroupLayoutOf(desc.bindings),
      texture,
    )
    this.passBindGroups.set(passId, group)
    return group
  }

  /**
   * The one place a GPU resource this HAL owns is released — see
   * {@link pendingDestroy} for why the frame decides when.
   *
   * Every buffer release routes here through the `RegionRegistry` destroy hook,
   * so `uploadBuffer`, `deleteBuffer`, `deleteRegion` and
   * `dispose` are all covered without any of them knowing a frame is open.
   */
  private destroyWhenIdle(resource: { destroy: () => void }) {
    if (this.currentEncoder) {
      this.pendingDestroy.push(resource)
    } else {
      resource.destroy()
    }
  }

  private drainPendingDestroy() {
    for (const resource of this.pendingDestroy) {
      resource.destroy()
    }
    this.pendingDestroy.length = 0
  }

  protected createTexture(
    passId: string,
    binding: TextureBinding,
    data: TextureSource,
    width: number,
    height: number,
  ) {
    const existing = this.passTextures.get(passId)
    if (existing) {
      // Same hazard as a buffer, and no longer a hypothetical one: every
      // `uploadTexture` in tree is a colour ramp, and since the ramp became a
      // `defineMark` `texture` they are all written by `GpuMarkBackend`'s
      // `bindRamp` from inside `drawRegion` — mid-frame, between an encoded
      // draw and its submit. The deferral is what makes replacing one there
      // safe.
      this.destroyWhenIdle(existing.texture)
    }
    const bytes = data instanceof Uint8Array
    const texture = this.device.createTexture({
      size: [width, height],
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        (bytes ? 0 : GPUTextureUsage.RENDER_ATTACHMENT),
    })
    if (bytes) {
      this.device.queue.writeTexture(
        { texture },
        data,
        { bytesPerRow: width * 4 },
        { width, height },
      )
    } else {
      this.device.queue.copyExternalImageToTexture(
        { source: data },
        { texture, premultipliedAlpha: true },
        { width, height },
      )
    }
    const sampler = this.device.createSampler({
      magFilter: binding.filter,
      minFilter: binding.filter,
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

  /**
   * Once per HAL, not once per frame: the refusal holds for every frame at this
   * canvas size, and dotplot and synteny keep their canvas mounted through a
   * `renderError`, so a per-frame report there never stops.
   *
   * Not terminal — a refusal tracks the canvas dimensions, so a resize can clear
   * it. `swapChainUnrecoverable` stays for the case it was written for.
   */
  private reportSurfaceFailure(message: string) {
    if (this.reportedSurfaceFailure) {
      return
    }
    this.reportedSurfaceFailure = true
    this.oom.reportClassified(createGpuSurfaceLostError(message))
  }

  beginFrame(clearR: number, clearG: number, clearB: number, clearA = 1) {
    // Skip the frame entirely rather than encode one that cannot be valid.
    // Zero-size canvas: nothing to draw. Missing MSAA target while MSAA is
    // configured: every pipeline was built with `multisample.count =
    // this.sampleCount`, so the single-sample fallback attachment below would
    // mismatch and every draw in the frame would be rejected. That happens after
    // `recreateMsaaTexture` bails on an over-`maxTextureDimension2D` canvas — it
    // has already reported through `oom`, so the user has the real message and
    // there is nothing to gain from also spraying validation errors each frame.
    if (
      this.disposed ||
      this.canvas.width === 0 ||
      this.canvas.height === 0 ||
      (this.sampleCount > 1 && !this.msaaView)
    ) {
      return
    }
    // A driver can refuse the canvas image without throwing — Dawn returns an
    // error texture and an error view, and the frame encodes against it — so the
    // acquisition needs a scope, and its own rather than the frame's: those stay
    // pushed iff an encoder is created, and one left on the device's stack
    // swallows every later frame's errors. Popped before the guard below, so
    // every path balances. Awaiting the pop here would suspend across a
    // GPU-process round trip and destroy the canvas texture mid-frame.
    this.device.pushErrorScope('validation')
    const textureView = this.acquireTextureView()
    void this.device
      .popErrorScope()
      .then(err => {
        if (err) {
          this.reportSurfaceFailure(err.message)
        }
      })
      .catch(() => {})
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
    // texture. Without MSAA (`sampleCount === 1`, so `msaaView` is never built):
    // render directly to the canvas texture. The guard above is what keeps those
    // the only two cases — a null `msaaView` while MSAA is on never reaches here.
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

  drawPass(
    passId: string,
    regionKey: number,
    bufferPassId?: string,
    verticesPerInstance?: number,
  ) {
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
    this.currentPass.draw(
      verticesPerInstance ?? desc.verticesPerInstance,
      regionBuf.count,
    )
  }

  /**
   * Close the frame's state whether the submit landed or threw.
   *
   * The scopes pushed in `beginFrame` have to be popped either way — leaving a
   * pair pushed makes every later frame's pop read an older frame's errors —
   * and the deferred destroys have to be drained either way, since a frame that
   * threw is a frame no later `endFrame` will run for.
   */
  private closeFrame(slotAtSubmit: number) {
    void this.device
      .popErrorScope()
      .then(err => {
        if (err) {
          // Genuine VRAM exhaustion during the frame (distinct from the proactive
          // over-limit checks in uploadBuffer/uploadTexture). Surface to the
          // display, not just the console — the view is too large for this GPU.
          this.oom.report(
            `This view exhausted GPU memory — zoom in or reduce the track height. (out-of-memory after submit, slot ${slotAtSubmit}: ${err.message})`,
          )
        }
      })
      .catch(() => {})
    void this.device
      .popErrorScope()
      .then(err => {
        if (err) {
          console.error(
            '[WebGPUHal] endFrame: VALIDATION error after submit, slot=',
            slotAtSubmit,
            err.message,
          )
        }
      })
      .catch(() => {})
    this.currentPass = null
    this.currentEncoder = null
    this.currentTextureView = null
    this.drainPendingDestroy()
  }

  endFrame() {
    const encoder = this.currentEncoder
    if (!encoder) {
      return
    }
    const slotAtSubmit = this.uniformSlot
    try {
      if (this.currentPass) {
        this.currentPass.end()
      }

      if (slotAtSubmit > 0) {
        const uploadSize = slotAtSubmit * this.alignedUniformSize
        this.device.queue.writeBuffer(
          this.uniformRingBuffer,
          0,
          this.uniformStaging,
          0,
          uploadSize,
        )
      }
      if (slotAtSubmit >= UNIFORM_SLOT_WARN_AT && !this.warnedUniformSlots) {
        this.warnedUniformSlots = true
        console.warn(
          `[WebGPUHal] this frame used ${slotAtSubmit} of ${MAX_UNIFORM_SLOTS} uniform ring slots. At the cap, writes are dropped and their draws render against another batch's uniforms — wrong pixels, no error. A count this high usually means a per-frame write inside a loop that has grown a dimension (stacked sections, displayed regions), or a write nothing draws with. Check the renderer before raising the cap.`,
        )
      }
      this.device.queue.submit([encoder.finish()])
    } finally {
      this.closeFrame(slotAtSubmit)
    }
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

  protected releaseResources() {
    // Abandon an open frame before releasing anything, so the releases below
    // are immediate: its encoded draws never reach the queue, and a deferral
    // here would have no `endFrame` left to drain it. The error scopes it
    // pushed are popped by `closeFrame` on the way out — the device outlives
    // this HAL, so a pair left pushed would report into a sibling's frame.
    if (this.currentEncoder) {
      this.closeFrame(this.uniformSlot)
    }
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
