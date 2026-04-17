/// <reference types="@webgpu/types" />

import { initGpuContext } from '../initGpuContext.ts'
import {
  STANDARD_BLEND_STATE,
  createStandardBindGroup,
  createStandardBindGroupLayout,
  createStorageBuffer,
  createUniformOnlyBindGroup,
  createUniformOnlyBindGroupLayout,
  createVertexBuffer,
  glToGpuVertexFormat,
} from '../webgpuUtils.ts'

import type { BlendState, GpuHal, PassDescriptor, RegionMeta } from './types.ts'

class ShaderCompileError extends Error {
  constructor(passId: string, details: string) {
    super(`WGSL compile error in pass "${passId}": ${details}`)
    this.name = 'ShaderCompileError'
  }
}

// Maximum number of writeUniforms() calls per frame. Each call occupies one
// aligned slot in the uniform ring buffer. 512 slots × 256-byte alignment =
// 128 KB — negligible GPU memory for eliminating per-draw command submissions.
const MAX_UNIFORM_SLOTS = 512
// Set to 1 to disable MSAA (e.g. to debug Firefox compositor stalls).
// All render-pass, texture, and pipeline setup is conditioned on this value,
// so changing it will not cause a mismatch.
const MSAA_SAMPLE_COUNT: 1 | 4 = 4

function gpuBlendState(bs: BlendState): GPUBlendState {
  // RGB uses the caller-supplied factors; alpha always uses ONE / ONE_MINUS_SRC_ALPHA
  // so the destination alpha accumulates correctly (matches webgl2Hal.applyBlendState).
  return {
    color: {
      srcFactor: bs.srcFactor,
      dstFactor: bs.dstFactor,
      operation: 'add',
    },
    alpha: {
      srcFactor: 'one',
      dstFactor: 'one-minus-src-alpha',
      operation: 'add',
    },
  }
}

// One entry per (region, pass). For storage-buffer passes, `dataBuffer` is
// the storage buffer bound at @group(0)@binding(0). For vertex-buffer passes,
// `dataBuffer` is the vertex buffer bound via setVertexBuffer(0, ...); the
// bind group has only the uniform at binding 1.
interface RegionPassBuffer {
  dataBuffer: GPUBuffer
  bindGroup: GPUBindGroup
  count: number
}

interface RegionState {
  meta: RegionMeta
  buffers: Map<string, RegionPassBuffer>
}

// Per-device shared state: bind group layouts and pipeline layouts.
// Identical across renderers so safe to share. We keep three layouts:
//   - standard: storage buffer (0) + uniform (1) — legacy hand-written shaders
//   - uniformOnly: uniform (1) only — vertex-buffer passes (Slang-authored)
//   - textured: storage + uniform + texture + sampler — variant matrix etc.
// Pipelines select the matching layout when created.
const deviceState = new WeakMap<
  GPUDevice,
  {
    bindGroupLayout: GPUBindGroupLayout
    pipelineLayout: GPUPipelineLayout
    uniformOnlyBindGroupLayout: GPUBindGroupLayout
    uniformOnlyPipelineLayout: GPUPipelineLayout
    texturedBindGroupLayout: GPUBindGroupLayout | null
    texturedPipelineLayout: GPUPipelineLayout | null
  }
>()

function getOrCreateDeviceState(device: GPUDevice) {
  let state = deviceState.get(device)
  if (!state) {
    const bindGroupLayout = createStandardBindGroupLayout(device)
    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    })
    const uniformOnlyBindGroupLayout = createUniformOnlyBindGroupLayout(device)
    const uniformOnlyPipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [uniformOnlyBindGroupLayout],
    })
    state = {
      bindGroupLayout,
      pipelineLayout,
      uniformOnlyBindGroupLayout,
      uniformOnlyPipelineLayout,
      texturedBindGroupLayout: null,
      texturedPipelineLayout: null,
    }
    deviceState.set(device, state)
  }
  return state
}

function getOrCreateTexturedLayout(
  device: GPUDevice,
  state: ReturnType<typeof getOrCreateDeviceState>,
) {
  if (!state.texturedBindGroupLayout) {
    state.texturedBindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'read-only-storage' as GPUBufferBindingType },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {
            type: 'uniform' as GPUBufferBindingType,
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
    state.texturedPipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [state.texturedBindGroupLayout],
    })
  }
  return {
    layout: state.texturedBindGroupLayout,
    pipelineLayout: state.texturedPipelineLayout!,
  }
}

async function compilePipelines(
  device: GPUDevice,
  descriptors: PassDescriptor[],
) {
  const state = getOrCreateDeviceState(device)
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
      const format = desc.picking
        ? ('rgba8unorm' as GPUTextureFormat)
        : preferredFormat
      const blend = desc.picking
        ? undefined
        : desc.blend
          ? desc.blendState
            ? gpuBlendState(desc.blendState)
            : STANDARD_BLEND_STATE
          : undefined
      const topo = (desc.topology ?? 'triangle-list') as GPUPrimitiveTopology
      // Three pipeline layouts, selected per pass — see deviceState docs.
      const pLayout = desc.textures?.length
        ? getOrCreateTexturedLayout(device, state).pipelineLayout
        : desc.vertexBuffer
          ? state.uniformOnlyPipelineLayout
          : state.pipelineLayout

      // Vertex-buffer passes declare their instance attribute layout here so
      // WebGPU knows how to feed @location(N) inputs from the bound vertex
      // buffer. Storage-buffer passes use an empty vertex.buffers (the shader
      // indexes `instances[iid]` directly).
      const vertexBuffers: GPUVertexBufferLayout[] = desc.vertexBuffer
        ? [
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
        : []

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
          desc.picking || MSAA_SAMPLE_COUNT === 1
            ? undefined
            : { count: MSAA_SAMPLE_COUNT },
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

export class WebGPUHal implements GpuHal {
  private device: GPUDevice
  private canvas: HTMLCanvasElement
  private context: GPUCanvasContext
  private regions = new Map<number, RegionState>()
  private descriptors: Map<string, PassDescriptor>
  private pipelines: ReadonlyMap<string, GPURenderPipeline>
  private passTextures = new Map<string, PassTextureState>()

  // Uniform ring buffer: holds up to MAX_UNIFORM_SLOTS sets of uniforms so
  // that all draw calls in a frame can reference different uniform data via
  // dynamic offsets, enabling a single command encoder + submit per frame.
  private uniformByteSize: number
  private alignedUniformSize: number
  private uniformRingBuffer: GPUBuffer
  private uniformStaging: ArrayBuffer
  private uniformStagingU8: Uint8Array
  private uniformSlot = 0

  // MSAA resolve texture — 4x multisampled render target
  private msaaTexture: GPUTexture | null = null
  private msaaView: GPUTextureView | null = null

  // Frame state — single render pass batches all draws per frame so MSAA
  // resolves only once, eliminating artifacts from intermediate resolves.
  private currentTextureView: GPUTextureView | null = null
  private currentEncoder: GPUCommandEncoder | null = null
  private currentPass: GPURenderPassEncoder | null = null

  // Scissor/viewport state (physical pixels, top-left origin)
  private scissorRect: { x: number; y: number; w: number; h: number } | null =
    null
  private viewportRect: { x: number; y: number; w: number; h: number } | null =
    null

  // Picking state
  private pickingTexture: GPUTexture | null = null
  private pickingStagingBuffer: GPUBuffer | null = null
  private cachedPickResult = -1

  private constructor(
    device: GPUDevice,
    canvas: HTMLCanvasElement,
    context: GPUCanvasContext,
    descriptors: PassDescriptor[],
    uniformByteSize: number,
    pipelines: Map<string, GPURenderPipeline>,
  ) {
    this.device = device
    this.canvas = canvas
    this.context = context
    this.descriptors = new Map(descriptors.map(d => [d.id, d]))
    this.pipelines = pipelines
    this.uniformByteSize = uniformByteSize

    // Align uniform slots to device requirements for dynamic offsets
    const alignment = device.limits.minUniformBufferOffsetAlignment
    this.alignedUniformSize = Math.ceil(uniformByteSize / alignment) * alignment

    const ringSize = MAX_UNIFORM_SLOTS * this.alignedUniformSize
    this.uniformRingBuffer = device.createBuffer({
      size: ringSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    this.uniformStaging = new ArrayBuffer(ringSize)
    this.uniformStagingU8 = new Uint8Array(this.uniformStaging)
  }

  static async create(
    canvas: HTMLCanvasElement,
    descriptors: PassDescriptor[],
    uniformByteSize: number,
  ) {
    // Chrome/Dawn computes minimum buffer binding size for runtime-sized
    // storage arrays as roundUp(16, structSize). Only applies when the shader
    // reads instance data via `var<storage, read> array<T>` — vertex buffer
    // attributes have no such constraint (stride just needs to be a multiple
    // of 4).
    for (const desc of descriptors) {
      const usesStorageBuffer = /\bvar\s*<\s*storage\b/.test(desc.wgslSource)
      if (usesStorageBuffer && desc.instanceStride % 16 !== 0) {
        console.error(
          `[WebGPUHal] Pass "${desc.id}" instanceStride=${desc.instanceStride} is not a multiple of 16 — ` +
            'Chrome will reject draws with a binding-size validation error',
        )
      }
    }
    const result = await initGpuContext(canvas, { alphaMode: 'premultiplied' })
    if (!result) {
      return null
    }
    const pipelines = await compilePipelines(result.device, descriptors)
    return new WebGPUHal(
      result.device,
      canvas,
      result.context,
      descriptors,
      uniformByteSize,
      pipelines,
    )
  }

  resize(width: number, height: number) {
    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1
    const pw = Math.round(width * dpr)
    const ph = Math.round(height * dpr)
    const sizeChanged = this.canvas.width !== pw || this.canvas.height !== ph
    if (sizeChanged) {
      this.canvas.width = pw
      this.canvas.height = ph
      this.canvas.style.width = `${width}px`
      this.canvas.style.height = `${height}px`
    }
    if (sizeChanged || !this.msaaTexture) {
      this.recreateMsaaTexture(pw, ph)
    }
  }

  private recreateMsaaTexture(width: number, height: number) {
    this.msaaTexture?.destroy()
    this.msaaTexture = null
    this.msaaView = null
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

  uploadBuffer(
    regionKey: number,
    passId: string,
    data: ArrayBuffer | ArrayBufferView,
    count: number,
  ) {
    const region = this.getOrCreateRegion(regionKey)
    const existing = region.buffers.get(passId)
    if (existing) {
      existing.dataBuffer.destroy()
    }

    if (count === 0) {
      region.buffers.delete(passId)
      return
    }

    const state = deviceState.get(this.device)
    if (!state) {
      return
    }
    const desc = this.descriptors.get(passId)
    const texState = this.passTextures.get(passId)

    // Vertex-buffer passes: data becomes a vertex buffer bound via
    // setVertexBuffer(0, ...) at draw time; bind group carries only the
    // uniform (texture-sampling vertex-buffer passes are not yet supported).
    if (desc?.vertexBuffer) {
      const dataBuffer = createVertexBuffer(this.device, data)
      const bindGroup = createUniformOnlyBindGroup(
        this.device,
        state.uniformOnlyBindGroupLayout,
        this.uniformRingBuffer,
        this.alignedUniformSize,
      )
      region.buffers.set(passId, { dataBuffer, bindGroup, count })
      return
    }

    // Storage-buffer passes (legacy path): data is bound at @binding(0).
    const dataBuffer = createStorageBuffer(this.device, data)
    if (desc?.textures?.length && texState) {
      const { layout } = getOrCreateTexturedLayout(this.device, state)
      const bindGroup = this.device.createBindGroup({
        layout,
        entries: [
          { binding: 0, resource: { buffer: dataBuffer } },
          {
            binding: 1,
            resource: {
              buffer: this.uniformRingBuffer,
              offset: 0,
              size: this.alignedUniformSize,
            },
          },
          { binding: 2, resource: texState.texture.createView() },
          { binding: 3, resource: texState.sampler },
        ],
      })
      region.buffers.set(passId, { dataBuffer, bindGroup, count })
    } else {
      const bindGroup = createStandardBindGroup(
        this.device,
        state.bindGroupLayout,
        dataBuffer,
        this.uniformRingBuffer,
        this.alignedUniformSize,
      )
      region.buffers.set(passId, { dataBuffer, bindGroup, count })
    }
  }

  setRegionMeta(regionKey: number, meta: Partial<RegionMeta>) {
    const region = this.getOrCreateRegion(regionKey)
    if (meta.regionStart !== undefined) {
      region.meta.regionStart = meta.regionStart
    }
    if (meta.maxDepth !== undefined) {
      region.meta.maxDepth = meta.maxDepth
    }
  }

  getRegionMeta(regionKey: number) {
    return this.regions.get(regionKey)?.meta
  }

  getBufferCount(regionKey: number, passId: string) {
    return this.regions.get(regionKey)?.buffers.get(passId)?.count ?? 0
  }

  deleteBuffer(regionKey: number, passId: string) {
    if (this.currentEncoder) {
      console.warn(
        `[WebGPUHal] deleteBuffer(${regionKey}, ${passId}) called mid-frame — ` +
          'in-flight render passes may reference this buffer',
      )
    }
    const region = this.regions.get(regionKey)
    if (region) {
      const buf = region.buffers.get(passId)
      if (buf) {
        buf.dataBuffer.destroy()
        region.buffers.delete(passId)
      }
    }
  }

  deleteRegion(regionKey: number) {
    if (this.currentEncoder) {
      console.warn(
        `[WebGPUHal] deleteRegion(${regionKey}) called mid-frame — ` +
          'in-flight render passes may reference these buffers',
      )
    }
    const region = this.regions.get(regionKey)
    if (region) {
      for (const buf of region.buffers.values()) {
        buf.dataBuffer.destroy()
      }
      this.regions.delete(regionKey)
    }
  }

  deleteAllRegions() {
    if (this.currentEncoder) {
      console.warn(
        '[WebGPUHal] deleteAllRegions called mid-frame — ' +
          'in-flight render passes may reference these buffers',
      )
    }
    for (const region of this.regions.values()) {
      for (const buf of region.buffers.values()) {
        buf.dataBuffer.destroy()
      }
    }
    this.regions.clear()
  }

  uploadTexture(
    passId: string,
    data: Uint8Array,
    width: number,
    height: number,
  ) {
    const desc = this.descriptors.get(passId)
    if (!desc?.textures?.length) {
      return
    }
    const existing = this.passTextures.get(passId)
    if (existing) {
      existing.texture.destroy()
    }
    const tb = desc.textures[0]!
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

    // Rebuild bind groups for all regions that have buffers for this pass
    for (const [regionKey, region] of this.regions) {
      const buf = region.buffers.get(passId)
      if (buf) {
        this.rebuildTexturedBindGroup(
          regionKey,
          passId,
          buf.dataBuffer,
          buf.count,
        )
      }
    }
  }

  writeUniforms(data: ArrayBuffer) {
    if (this.currentEncoder) {
      // Inside a frame: stage data at the current slot for batched upload
      if (this.uniformSlot >= MAX_UNIFORM_SLOTS) {
        console.error(
          '[WebGPUHal] uniform ring buffer exhausted — increase MAX_UNIFORM_SLOTS',
        )
        return
      }
      const offset = this.uniformSlot * this.alignedUniformSize
      this.uniformStagingU8.set(new Uint8Array(data), offset)
      this.uniformSlot++
    } else {
      // Outside a frame (e.g. picking): write directly to slot 0
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
    const regionBuf = this.regions
      .get(regionKey)
      ?.buffers.get(bufferPassId ?? passId)
    if (!regionBuf || regionBuf.count === 0) {
      return
    }

    const desc = this.descriptors.get(passId)
    if (!desc) {
      return
    }

    // uniformSlot is post-incremented in writeUniforms, so slot (uniformSlot-1)
    // holds the uniforms written for this draw call.
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
    // Vertex-buffer passes feed per-instance data through slot 0 of the
    // pipeline's vertex.buffers layout (see compilePipelines). Storage-buffer
    // passes index the bound storage buffer directly from the shader, so no
    // vertex buffer needs to be bound.
    if (desc.vertexBuffer) {
      this.currentPass.setVertexBuffer(0, regionBuf.dataBuffer)
    }
    this.currentPass.draw(desc.verticesPerInstance, regionBuf.count, 0, 0)
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
        console.error(
          '[WebGPUHal] endFrame: OUT-OF-MEMORY error after submit, slot=',
          slotAtSubmit,
          err.message,
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

  drawPickingPass(
    passId: string,
    regionKey: number,
    instanceCount?: number,
    bufferPassId?: string,
  ) {
    const pipeline = this.pipelines.get(passId)
    if (!pipeline) {
      return
    }
    const regionBuf = this.regions
      .get(regionKey)
      ?.buffers.get(bufferPassId ?? passId)
    if (!regionBuf || regionBuf.count === 0) {
      return
    }
    const desc = this.descriptors.get(passId)
    if (!desc) {
      return
    }

    this.ensurePickingTexture()
    if (!this.pickingTexture) {
      return
    }

    // Picking runs outside the frame cycle with its own encoder.
    // writeUniforms called before this wrote directly to slot 0.
    const encoder = this.device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.pickingTexture.createView(),
          loadOp: 'clear' as GPULoadOp,
          storeOp: 'store' as GPUStoreOp,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
        },
      ],
    })
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, regionBuf.bindGroup, [0])
    if (desc.vertexBuffer) {
      pass.setVertexBuffer(0, regionBuf.dataBuffer)
    }
    pass.draw(desc.verticesPerInstance, instanceCount ?? regionBuf.count)
    pass.end()
    this.device.queue.submit([encoder.finish()])
  }

  readPickingPixel(_x: number, _y: number) {
    return this.cachedPickResult
  }

  async readPickingPixelAsync(x: number, y: number) {
    if (!this.pickingTexture || !this.pickingStagingBuffer) {
      return -1
    }
    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1
    const px = Math.floor(x * dpr)
    const py = Math.floor(y * dpr)
    if (
      px < 0 ||
      px >= this.canvas.width ||
      py < 0 ||
      py >= this.canvas.height
    ) {
      return -1
    }

    const encoder = this.device.createCommandEncoder()
    encoder.copyTextureToBuffer(
      { texture: this.pickingTexture, origin: [px, py, 0] },
      { buffer: this.pickingStagingBuffer, bytesPerRow: 256 },
      [1, 1, 1],
    )
    this.device.queue.submit([encoder.finish()])

    try {
      await this.pickingStagingBuffer.mapAsync(GPUMapMode.READ)
    } catch {
      this.resetStagingBuffer()
      return -1
    }
    let result: number
    try {
      const data = new Uint8Array(this.pickingStagingBuffer.getMappedRange())
      const r = data[0]!
      const g = data[1]!
      const b = data[2]!
      // RGB(0,0,0) = no feature. Otherwise decode the 1-based 24-bit index and
      // convert to 0-based.
      result = r === 0 && g === 0 && b === 0 ? -1 : r + g * 256 + b * 65536 - 1
    } finally {
      try {
        this.pickingStagingBuffer.unmap()
      } catch {}
    }
    this.cachedPickResult = result
    return result
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
    this.deleteAllRegions()
    this.uniformRingBuffer.destroy()
    for (const ts of this.passTextures.values()) {
      ts.texture.destroy()
    }
    this.passTextures.clear()
    this.msaaTexture?.destroy()
    this.pickingTexture?.destroy()
    this.pickingStagingBuffer?.destroy()
  }

  private ensurePickingTexture() {
    const w = this.canvas.width
    const h = this.canvas.height
    if (w === 0 || h === 0) {
      return
    }
    if (this.pickingTexture) {
      if (this.pickingTexture.width === w && this.pickingTexture.height === h) {
        return
      }
      this.pickingTexture.destroy()
    }
    this.pickingTexture = this.device.createTexture({
      size: [w, h],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    })
    if (!this.pickingStagingBuffer) {
      this.pickingStagingBuffer = this.device.createBuffer({
        size: 256,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      })
    }
  }

  private resetStagingBuffer() {
    try {
      this.pickingStagingBuffer?.destroy()
    } catch {}
    this.pickingStagingBuffer = this.device.createBuffer({
      size: 256,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    })
  }

  private rebuildTexturedBindGroup(
    regionKey: number,
    passId: string,
    dataBuffer: GPUBuffer,
    count: number,
  ) {
    const state = deviceState.get(this.device)
    if (!state) {
      return
    }
    const texState = this.passTextures.get(passId)
    if (!texState) {
      return
    }
    const { layout } = getOrCreateTexturedLayout(this.device, state)
    const bindGroup = this.device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: { buffer: dataBuffer } },
        {
          binding: 1,
          resource: {
            buffer: this.uniformRingBuffer,
            offset: 0,
            size: this.alignedUniformSize,
          },
        },
        { binding: 2, resource: texState.texture.createView() },
        { binding: 3, resource: texState.sampler },
      ],
    })
    const region = this.regions.get(regionKey)
    if (region) {
      region.buffers.set(passId, { dataBuffer, bindGroup, count })
    }
  }

  private getOrCreateRegion(regionKey: number) {
    let region = this.regions.get(regionKey)
    if (!region) {
      region = {
        meta: { regionStart: 0, maxDepth: 0 },
        buffers: new Map(),
      }
      this.regions.set(regionKey, region)
    }
    return region
  }
}
