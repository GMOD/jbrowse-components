/// <reference types="@webgpu/types" />

import { syncCanvasSize } from '../canvas2dUtils.ts'
import { getGpuDevice } from '../gpuDevice.ts'
import {
  STANDARD_BLEND_STATE,
  createUniformOnlyBindGroup,
  createUniformOnlyBindGroupLayout,
  createVertexBuffer,
  glToGpuVertexFormat,
} from '../webgpuUtils.ts'
import { OomReporter } from './oomReporter.ts'
import { RegionRegistry } from './regionRegistry.ts'

import type { BlendState, GpuHal, PassDescriptor } from './types.ts'

class ShaderCompileError extends Error {
  constructor(passId: string, details: string) {
    super(`WGSL compile error in pass "${passId}": ${details}`)
    this.name = 'ShaderCompileError'
  }
}

// Maximum number of writeUniforms() calls per frame. Each call occupies one
// aligned slot in the uniform ring buffer. 2048 slots × 256-byte alignment =
// 512 KB — trivial GPU memory, generous headroom (busy alignments tracks do
// ~50 writes/frame). Exhausting it would silently drop draws; if we ever
// hit the cap, switch to a dynamic-growth buffer (recreate buffer + every
// region's bind group) rather than just bumping the constant again.
const MAX_UNIFORM_SLOTS = 2048
// Set to 1 to disable MSAA (e.g. to debug Firefox compositor stalls).
// All render-pass, texture, and pipeline setup is conditioned on this value,
// so changing it will not cause a mismatch.
const MSAA_SAMPLE_COUNT: 1 | 4 = 4

function gpuBlendState(bs: BlendState): GPUBlendState {
  // RGB uses the caller-supplied factors; alpha always uses ONE / ONE_MINUS_SRC_ALPHA
  // so the destination alpha accumulates correctly (matches webgl2Hal.applyBlendState).
  // 'max' applies to both components (factors ignored by the max operation), so
  // same-color overlaps take the higher coverage instead of accumulating.
  const operation = bs.op ?? 'add'
  return {
    color: {
      srcFactor: bs.srcFactor,
      dstFactor: bs.dstFactor,
      operation,
    },
    alpha: {
      srcFactor: 'one',
      dstFactor: 'one-minus-src-alpha',
      operation,
    },
  }
}

// One entry per (region, pass). `dataBuffer` is the vertex buffer bound via
// setVertexBuffer(0, ...). `bindGroup` is null if the pass requires a texture
// that hasn't been uploaded yet; drawPass skips such entries.
interface RegionPassBuffer {
  dataBuffer: GPUBuffer
  bindGroup: GPUBindGroup | null
  count: number
}

// Per-HAL bind group and pipeline layouts. Two layouts, both @group(0):
//   - uniformOnly: uniform buffer (binding 1) only
//   - textured: uniform (1) + texture (2) + sampler (3), created lazily on first use
// Every pass reads per-instance data from a vertex buffer (no storage binding
// at 0) because Slang-generated shaders cross-compile to GLSL ES, which has
// no SSBOs.
interface LayoutState {
  uniformOnlyBindGroupLayout: GPUBindGroupLayout
  uniformOnlyPipelineLayout: GPUPipelineLayout
  // Lazily created on first pass with textures. Bundled so null/non-null is
  // always consistent between the two — avoids a non-null assertion on access.
  texturedLayouts: {
    bindGroupLayout: GPUBindGroupLayout
    pipelineLayout: GPUPipelineLayout
  } | null
}

function createLayoutState(device: GPUDevice): LayoutState {
  const uniformOnlyBindGroupLayout = createUniformOnlyBindGroupLayout(device)
  return {
    uniformOnlyBindGroupLayout,
    uniformOnlyPipelineLayout: device.createPipelineLayout({
      bindGroupLayouts: [uniformOnlyBindGroupLayout],
    }),
    texturedLayouts: null,
  }
}

function getOrCreateTexturedLayout(device: GPUDevice, state: LayoutState) {
  if (!state.texturedLayouts) {
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {
            type: 'uniform',
            hasDynamicOffset: true,
          },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'float' },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: 'filtering' },
        },
      ],
    })
    state.texturedLayouts = {
      bindGroupLayout,
      pipelineLayout: device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
    }
  }
  return state.texturedLayouts
}

async function compilePipelines(
  device: GPUDevice,
  descriptors: PassDescriptor[],
  state: LayoutState,
) {
  const preferredFormat = navigator.gpu.getPreferredCanvasFormat()
  const pipelines = new Map<string, GPURenderPipeline>()

  await Promise.all(
    descriptors.map(async desc => {
      const module = device.createShaderModule({ code: desc.wgslSource })
      const info = await module.getCompilationInfo()
      const errors = info.messages.filter(m => m.type === 'error')
      if (errors.length > 0) {
        const details = errors
          .map(m => `line ${m.lineNum}: ${m.message}`)
          .join('; ')
        throw new ShaderCompileError(desc.id, details)
      }
      const fragEntry = desc.wgslFragmentEntry ?? 'fs_main'
      const format: GPUTextureFormat = preferredFormat
      const blend = desc.blend
        ? desc.blendState
          ? gpuBlendState(desc.blendState)
          : STANDARD_BLEND_STATE
        : undefined
      const topo: GPUPrimitiveTopology = desc.topology ?? 'triangle-list'
      const pLayout = desc.textures?.length
        ? getOrCreateTexturedLayout(device, state).pipelineLayout
        : state.uniformOnlyPipelineLayout

      // Every pass feeds @location(N) inputs from a bound vertex buffer.
      const vertexBuffers: GPUVertexBufferLayout[] = [
        {
          arrayStride: desc.instanceStride,
          stepMode: 'instance',
          attributes: desc.glAttributes.map((attr, i) => ({
            shaderLocation: i,
            offset: attr.offsetBytes,
            format: glToGpuVertexFormat(attr),
          })),
        },
      ]

      const pipeline = await device.createRenderPipelineAsync({
        layout: pLayout,
        vertex: {
          module,
          entryPoint: 'vs_main',
          buffers: vertexBuffers,
        },
        fragment: {
          module,
          entryPoint: fragEntry,
          targets: [{ format, ...(blend && { blend }) }],
        },
        primitive: { topology: topo },
        multisample:
          MSAA_SAMPLE_COUNT === 1 ? undefined : { count: MSAA_SAMPLE_COUNT },
      })
      pipelines.set(desc.id, pipeline)
    }),
  )

  return pipelines
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
// webgpu vs canvas2d output; glAttributeSync.test.ts checks attribute layout
// against the shader; shared buffer bookkeeping is covered by
// hal/regionRegistry.test.ts. Mirror any behavior change in webgl2Hal.ts.
export class WebGPUHal implements GpuHal {
  private device: GPUDevice
  private canvas: HTMLCanvasElement
  private context: GPUCanvasContext
  private regions: RegionRegistry<RegionPassBuffer>
  private descriptors: Map<string, PassDescriptor>
  private pipelines: ReadonlyMap<string, GPURenderPipeline>
  private passTextures = new Map<string, PassTextureState>()
  private layoutState: LayoutState

  // Uniform ring buffer: holds up to MAX_UNIFORM_SLOTS sets of uniforms so
  // that all draw calls in a frame can reference different uniform data via
  // dynamic offsets, enabling a single command encoder + submit per frame.
  private alignedUniformSize: number
  private uniformRingBuffer: GPUBuffer
  private uniformStaging: Uint8Array
  private uniformSlot = 0

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

  // Scissor/viewport state (physical pixels, top-left origin)
  private scissorRect: Rect | null = null
  private viewportRect: Rect | null = null

  // Guards dispose() against double invocation (pagehide + React cleanup can
  // both fire).
  private disposed = false

  private oom = new OomReporter('WebGPUHal')

  private constructor(
    device: GPUDevice,
    canvas: HTMLCanvasElement,
    context: GPUCanvasContext,
    descriptors: PassDescriptor[],
    uniformByteSize: number,
    pipelines: Map<string, GPURenderPipeline>,
    layoutState: LayoutState,
  ) {
    this.device = device
    this.canvas = canvas
    this.context = context
    this.descriptors = new Map(descriptors.map(d => [d.id, d]))
    this.pipelines = pipelines
    this.layoutState = layoutState

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
      layoutState.uniformOnlyBindGroupLayout,
      this.uniformRingBuffer,
      this.alignedUniformSize,
    )
    this.regions = new RegionRegistry<RegionPassBuffer>(buf => {
      buf.dataBuffer.destroy()
    })
  }

  static async create(
    canvas: HTMLCanvasElement,
    descriptors: PassDescriptor[],
    uniformByteSize: number,
  ) {
    const device = await getGpuDevice()
    if (!device) {
      return null
    }
    // Compile pipelines BEFORE acquiring the canvas's webgpu context. A canvas's
    // context type is permanent once acquired, so if shader compilation throws
    // here the canvas stays pristine and createGpuHal's WebGL2 fallback can
    // still claim it — otherwise a partial WebGPU init would drop us all the way
    // to Canvas2D on a WebGL2-capable machine.
    const layoutState = createLayoutState(device)
    const pipelines = await compilePipelines(device, descriptors, layoutState)
    const context = canvas.getContext('webgpu')
    if (!context) {
      console.warn(
        '[WebGPUHal] WebGPU device available but canvas context failed',
      )
      return null
    }
    context.configure({
      device,
      format: navigator.gpu.getPreferredCanvasFormat(),
      alphaMode: 'premultiplied',
    })
    return new WebGPUHal(
      device,
      canvas,
      context,
      descriptors,
      uniformByteSize,
      pipelines,
      layoutState,
    )
  }

  resize(width: number, height: number) {
    const sizeChanged = syncCanvasSize(this.canvas, width, height)
    if (sizeChanged || !this.msaaTexture) {
      this.recreateMsaaTexture(this.canvas.width, this.canvas.height)
    }
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
    const bindGroup = this.buildBindGroupForPass(passId)
    this.regions.set(regionKey, passId, { dataBuffer, bindGroup, count })
  }

  // Build the bind group matching the pipeline layout for `passId`. Returns
  // null when the pass requires a texture that hasn't been uploaded yet;
  // drawPass skips such entries and uploadTexture rebuilds them once the
  // texture arrives. Uniform-only passes reuse `this.uniformOnlyBindGroup`
  // (all such bind groups would be byte-identical anyway).
  private buildBindGroupForPass(passId: string): GPUBindGroup | null {
    const desc = this.descriptors.get(passId)
    if (!desc) {
      return null
    }
    const tb = desc.textures?.[0]
    if (tb) {
      const texState = this.passTextures.get(passId)
      if (!texState) {
        return null
      }
      const { bindGroupLayout } = getOrCreateTexturedLayout(
        this.device,
        this.layoutState,
      )
      return this.device.createBindGroup({
        layout: bindGroupLayout,
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

  beginUpload() {
    this.regions.beginUpload()
  }

  endUpload() {
    this.regions.endUpload()
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

    // Rebuild bind groups for all regions whose data was uploaded before the
    // texture arrived (they were stored with a null bind group).
    this.regions.forEachInPass(passId, buf => {
      buf.bindGroup = this.buildBindGroupForPass(passId)
    })
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

  beginFrame(clearR: number, clearG: number, clearB: number, clearA = 1) {
    if (this.canvas.width === 0 || this.canvas.height === 0) {
      return
    }
    // Push error scopes so endFrame can report OOM/validation errors after submit.
    // Must be pushed here (after the early-return) so endFrame's early-return on
    // !currentEncoder stays paired: scopes are pushed iff an encoder is created.
    this.device.pushErrorScope('validation')
    this.device.pushErrorScope('out-of-memory')
    this.scissorRect = null
    this.viewportRect = null
    this.currentTextureView = this.context.getCurrentTexture().createView()
    this.currentEncoder = this.device.createCommandEncoder()
    this.uniformSlot = 0

    // With MSAA: render to multisampled texture, then resolve to the canvas texture.
    // Without MSAA (MSAA_SAMPLE_COUNT === 1): render directly to the canvas texture.
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
    if (!regionBuf || regionBuf.count === 0 || !regionBuf.bindGroup) {
      return
    }

    const desc = this.descriptors.get(passId)
    if (!desc) {
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

    if (this.viewportRect) {
      const v = this.viewportRect
      this.currentPass.setViewport(v.x, v.y, v.w, v.h, 0, 1)
    }
    if (this.scissorRect) {
      const s = this.scissorRect
      this.currentPass.setScissorRect(s.x, s.y, s.w, s.h)
    }
    this.currentPass.setPipeline(pipeline)
    this.currentPass.setBindGroup(0, regionBuf.bindGroup, [dynamicOffset])
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
    this.msaaTexture?.destroy()
    // Release the swapchain so the browser can reclaim GPU memory immediately
    // rather than waiting for the canvas to be GC'd.
    this.context.unconfigure()
  }
}
