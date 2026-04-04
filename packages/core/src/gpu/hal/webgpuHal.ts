/// <reference types="@webgpu/types" />

import getGpuDevice from '../getGpuDevice.ts'
import { initGpuContext } from '../initGpuContext.ts'
import {
  STANDARD_BLEND_STATE,
  createStandardBindGroup,
  createStandardBindGroupLayout,
  createStorageBuffer,
} from '../webgpuUtils.ts'

import type { BlendState, GpuHal, PassDescriptor, RegionMeta } from './types.ts'

// Maximum number of writeUniforms() calls per frame. Each call occupies one
// aligned slot in the uniform ring buffer. 512 slots × 256-byte alignment =
// 128 KB — negligible GPU memory for eliminating per-draw command submissions.
const MAX_UNIFORM_SLOTS = 512

function gpuBlendState(bs: BlendState): GPUBlendState {
  return {
    color: {
      srcFactor: bs.srcFactor as GPUBlendFactor,
      dstFactor: bs.dstFactor as GPUBlendFactor,
      operation: 'add',
    },
    alpha: {
      srcFactor: bs.srcFactor as GPUBlendFactor,
      dstFactor: bs.dstFactor as GPUBlendFactor,
      operation: 'add',
    },
  }
}

interface RegionPassBuffer {
  storageBuffer: GPUBuffer
  bindGroup: GPUBindGroup
  count: number
}

interface RegionState {
  meta: RegionMeta
  buffers: Map<string, RegionPassBuffer>
}

// Per-device shared state: bind group layouts and compiled pipelines.
// Multiple HAL instances can share a device — pipelines are merged incrementally.
const deviceState = new WeakMap<
  GPUDevice,
  {
    bindGroupLayout: GPUBindGroupLayout
    pipelineLayout: GPUPipelineLayout
    texturedBindGroupLayout: GPUBindGroupLayout | null
    texturedPipelineLayout: GPUPipelineLayout | null
    pipelines: Map<string, GPURenderPipeline>
  }
>()

function getOrCreateDeviceState(device: GPUDevice) {
  let state = deviceState.get(device)
  if (!state) {
    const bindGroupLayout = createStandardBindGroupLayout(device)
    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    })
    state = {
      bindGroupLayout,
      pipelineLayout,
      texturedBindGroupLayout: null,
      texturedPipelineLayout: null,
      pipelines: new Map(),
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

async function ensurePipelines(
  device: GPUDevice,
  descriptors: PassDescriptor[],
) {
  const state = getOrCreateDeviceState(device)

  const missing = descriptors.filter(d => !state.pipelines.has(d.id))
  if (missing.length === 0) {
    return
  }

  await Promise.all(
    missing.map(async desc => {
      const module = device.createShaderModule({ code: desc.wgslSource })
      const info = await module.getCompilationInfo()
      for (const msg of info.messages) {
        if (msg.type === 'error') {
          console.error(
            `[WebGPUHal] WGSL error in pass "${desc.id}" ` +
              `line ${msg.lineNum}: ${msg.message}`,
          )
        }
      }
      const fragEntry = desc.wgslFragmentEntry ?? 'fs_main'
      const format = desc.picking
        ? ('rgba8unorm' as GPUTextureFormat)
        : ('bgra8unorm' as GPUTextureFormat)
      const blend = desc.picking
        ? undefined
        : desc.blend
          ? desc.blendState
            ? gpuBlendState(desc.blendState)
            : STANDARD_BLEND_STATE
          : undefined
      const topo = (desc.topology ?? 'triangle-list') as GPUPrimitiveTopology
      const pLayout = desc.textures?.length
        ? getOrCreateTexturedLayout(device, state).pipelineLayout
        : state.pipelineLayout
      const pipeline = await device.createRenderPipelineAsync({
        layout: pLayout,
        vertex: { module, entryPoint: 'vs_main' },
        fragment: {
          module,
          entryPoint: fragEntry,
          targets: [{ format, ...(blend && { blend }) }],
        },
        primitive: { topology: topo },
      })
      state.pipelines.set(desc.id, pipeline)
    }),
  )
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

  // Frame state — single encoder batches all render passes per frame
  private currentTextureView: GPUTextureView | null = null
  private currentEncoder: GPUCommandEncoder | null = null
  private isFirstPass = true

  // Scissor/viewport state (physical pixels, top-left origin)
  private scissorRect: { x: number; y: number; w: number; h: number } | null =
    null
  private viewportRect: { x: number; y: number; w: number; h: number } | null =
    null

  // Picking state
  private pickingTexture: GPUTexture | null = null
  private pickingStagingBuffer: GPUBuffer | null = null
  private cachedPickResult = -1

  private _clearColor = { r: 0, g: 0, b: 0, a: 1 }

  private constructor(
    device: GPUDevice,
    canvas: HTMLCanvasElement,
    context: GPUCanvasContext,
    descriptors: PassDescriptor[],
    uniformByteSize: number,
  ) {
    this.device = device
    this.canvas = canvas
    this.context = context
    this.descriptors = new Map(descriptors.map(d => [d.id, d]))
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
    const device = await getGpuDevice()
    if (!device) {
      return null
    }
    const result = await initGpuContext(canvas, { alphaMode: 'opaque' })
    if (!result) {
      return null
    }
    await ensurePipelines(device, descriptors)
    return new WebGPUHal(
      device,
      canvas,
      result.context,
      descriptors,
      uniformByteSize,
    )
  }

  resize(width: number, height: number) {
    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1
    const pw = Math.round(width * dpr)
    const ph = Math.round(height * dpr)
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw
      this.canvas.height = ph
      this.canvas.style.width = `${width}px`
      this.canvas.style.height = `${height}px`
    }
  }

  uploadBuffer(
    regionKey: number,
    passId: string,
    data: ArrayBuffer,
    count: number,
  ) {
    const region = this.getOrCreateRegion(regionKey)
    const existing = region.buffers.get(passId)
    if (existing) {
      existing.storageBuffer.destroy()
    }

    if (count === 0) {
      region.buffers.delete(passId)
      return
    }

    const state = deviceState.get(this.device)
    if (!state) {
      return
    }
    const storageBuffer = createStorageBuffer(this.device, data)
    const desc = this.descriptors.get(passId)
    const texState = this.passTextures.get(passId)
    if (desc?.textures?.length && texState) {
      const { layout } = getOrCreateTexturedLayout(this.device, state)
      const bindGroup = this.device.createBindGroup({
        layout,
        entries: [
          { binding: 0, resource: { buffer: storageBuffer } },
          {
            binding: 1,
            resource: {
              buffer: this.uniformRingBuffer,
              offset: 0,
              size: this.uniformByteSize,
            },
          },
          { binding: 2, resource: texState.texture.createView() },
          { binding: 3, resource: texState.sampler },
        ],
      })
      region.buffers.set(passId, { storageBuffer, bindGroup, count })
    } else {
      const bindGroup = createStandardBindGroup(
        this.device,
        state.bindGroupLayout,
        storageBuffer,
        this.uniformRingBuffer,
        this.uniformByteSize,
      )
      region.buffers.set(passId, { storageBuffer, bindGroup, count })
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
    const region = this.regions.get(regionKey)
    if (region) {
      const buf = region.buffers.get(passId)
      if (buf) {
        buf.storageBuffer.destroy()
        region.buffers.delete(passId)
      }
    }
  }

  deleteRegion(regionKey: number) {
    const region = this.regions.get(regionKey)
    if (region) {
      for (const buf of region.buffers.values()) {
        buf.storageBuffer.destroy()
      }
      this.regions.delete(regionKey)
    }
  }

  deleteAllRegions() {
    for (const region of this.regions.values()) {
      for (const buf of region.buffers.values()) {
        buf.storageBuffer.destroy()
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
          buf.storageBuffer,
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
    this.currentTextureView = this.context.getCurrentTexture().createView()
    this.currentEncoder = this.device.createCommandEncoder()
    this.isFirstPass = true
    this.uniformSlot = 0
    this._clearColor = { r: clearR, g: clearG, b: clearB, a: clearA }
  }

  drawPass(passId: string, regionKey: number, bufferPassId?: string) {
    const state = deviceState.get(this.device)
    if (!state || !this.currentTextureView || !this.currentEncoder) {
      return
    }
    const pipeline = state.pipelines.get(passId)
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

    // Dynamic offset points to the most recently written uniform slot
    const dynamicOffset =
      Math.max(0, this.uniformSlot - 1) * this.alignedUniformSize

    const pass = this.currentEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.currentTextureView,
          loadOp: (this.isFirstPass ? 'clear' : 'load') as GPULoadOp,
          storeOp: 'store' as GPUStoreOp,
          ...(this.isFirstPass && { clearValue: this._clearColor }),
        },
      ],
    })
    if (this.viewportRect) {
      const v = this.viewportRect
      pass.setViewport(v.x, v.y, v.w, v.h, 0, 1)
    }
    if (this.scissorRect) {
      const s = this.scissorRect
      pass.setScissorRect(s.x, s.y, s.w, s.h)
    }
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, regionBuf.bindGroup, [dynamicOffset])
    pass.draw(desc.verticesPerInstance, regionBuf.count, 0, 0)
    pass.end()
    this.isFirstPass = false
  }

  endFrame() {
    if (!this.currentEncoder) {
      return
    }

    if (this.isFirstPass && this.currentTextureView) {
      const pass = this.currentEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: this.currentTextureView,
            loadOp: 'clear' as GPULoadOp,
            storeOp: 'store' as GPUStoreOp,
            clearValue: this._clearColor,
          },
        ],
      })
      pass.end()
    }

    // Upload all staged uniform data in one writeBuffer, then submit
    // the single command buffer containing every render pass for this frame.
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
    this.device.queue.submit([this.currentEncoder.finish()])

    this.currentEncoder = null
    this.currentTextureView = null
  }

  drawPickingPass(
    passId: string,
    regionKey: number,
    instanceCount?: number,
    bufferPassId?: string,
  ) {
    const state = deviceState.get(this.device)
    if (!state) {
      return
    }
    const pipeline = state.pipelines.get(passId)
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
    let result = -1
    try {
      const data = new Uint8Array(this.pickingStagingBuffer.getMappedRange())
      const r = data[0]!
      const g = data[1]!
      const b = data[2]!
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

  pick(_x: number, _y: number) {
    return -1
  }

  getWebGLContext() {
    return null
  }

  dispose() {
    this.deleteAllRegions()
    this.uniformRingBuffer.destroy()
    for (const ts of this.passTextures.values()) {
      ts.texture.destroy()
    }
    this.passTextures.clear()
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
      const existing = this.pickingTexture
      if (existing.width === w && existing.height === h) {
        return
      }
      existing.destroy()
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
    storageBuffer: GPUBuffer,
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
        { binding: 0, resource: { buffer: storageBuffer } },
        {
          binding: 1,
          resource: {
            buffer: this.uniformRingBuffer,
            offset: 0,
            size: this.uniformByteSize,
          },
        },
        { binding: 2, resource: texState.texture.createView() },
        { binding: 3, resource: texState.sampler },
      ],
    })
    const region = this.regions.get(regionKey)
    if (region) {
      region.buffers.set(passId, { storageBuffer, bindGroup, count })
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
