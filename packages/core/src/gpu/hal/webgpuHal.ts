/// <reference types="@webgpu/types" />

import getGpuDevice from '../getGpuDevice.ts'
import { initGpuContext } from '../initGpuContext.ts'
import {
  STANDARD_BLEND_STATE,
  createStandardBindGroup,
  createStandardBindGroupLayout,
  createStorageBuffer,
} from '../webgpuUtils.ts'

import type { GpuHal, PassDescriptor, BlendState, RegionMeta } from './types.ts'

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

// Per-device shared state: bind group layout and compiled pipelines.
// Multiple HAL instances can share a device — pipelines are merged incrementally.
const deviceState = new WeakMap<
  GPUDevice,
  {
    bindGroupLayout: GPUBindGroupLayout
    pipelineLayout: GPUPipelineLayout
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
      pipelines: new Map(),
    }
    deviceState.set(device, state)
  }
  return state
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
      const blend =
        desc.picking ? undefined
        : desc.blend ? (desc.blendState ? gpuBlendState(desc.blendState) : STANDARD_BLEND_STATE)
        : undefined
      const topo = (desc.topology ?? 'triangle-list') as GPUPrimitiveTopology
      const pipeline = await device.createRenderPipelineAsync({
        layout: state.pipelineLayout,
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

export class WebGPUHal implements GpuHal {
  private device: GPUDevice
  private canvas: HTMLCanvasElement
  private context: GPUCanvasContext
  private uniformBuffer: GPUBuffer
  private regions = new Map<number, RegionState>()
  private descriptors: PassDescriptor[]

  // Frame state
  private currentTextureView: GPUTextureView | null = null
  private isFirstPass = true

  // Scissor/viewport state (physical pixels, top-left origin)
  private scissorRect: { x: number; y: number; w: number; h: number } | null = null
  private viewportRect: { x: number; y: number; w: number; h: number } | null = null

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
  ) {
    this.device = device
    this.canvas = canvas
    this.context = context
    this.descriptors = descriptors
    this.uniformBuffer = device.createBuffer({
      size: uniformByteSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
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
    const bindGroup = createStandardBindGroup(
      this.device,
      state.bindGroupLayout,
      storageBuffer,
      this.uniformBuffer,
    )
    region.buffers.set(passId, { storageBuffer, bindGroup, count })
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

  writeUniforms(data: ArrayBuffer) {
    this.device.queue.writeBuffer(this.uniformBuffer, 0, data)
  }

  beginFrame(clearR: number, clearG: number, clearB: number, clearA = 1) {
    this.currentTextureView = this.context.getCurrentTexture().createView()
    this.isFirstPass = true
    this._clearColor = { r: clearR, g: clearG, b: clearB, a: clearA }
  }

  private _clearColor = { r: 0, g: 0, b: 0, a: 1 }

  drawPass(passId: string, regionKey: number, bufferPassId?: string) {
    const state = deviceState.get(this.device)
    if (!state || !this.currentTextureView) {
      return
    }
    const pipeline = state.pipelines.get(passId)
    if (!pipeline) {
      return
    }
    const regionBuf = this.regions.get(regionKey)?.buffers.get(bufferPassId ?? passId)
    if (!regionBuf || regionBuf.count === 0) {
      return
    }

    const desc = this.descriptors.find(d => d.id === passId)
    if (!desc) {
      return
    }

    const encoder = this.device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
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
    pass.setBindGroup(0, regionBuf.bindGroup)
    pass.draw(desc.verticesPerInstance, regionBuf.count, 0, 0)
    pass.end()
    this.device.queue.submit([encoder.finish()])
    this.isFirstPass = false
  }

  endFrame() {
    if (this.isFirstPass && this.currentTextureView) {
      const encoder = this.device.createCommandEncoder()
      const pass = encoder.beginRenderPass({
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
      this.device.queue.submit([encoder.finish()])
    }
    this.currentTextureView = null
  }

  drawPickingPass(passId: string, regionKey: number, instanceCount?: number, bufferPassId?: string) {
    const state = deviceState.get(this.device)
    if (!state || !this.currentTextureView) {
      return
    }
    const pipeline = state.pipelines.get(passId)
    if (!pipeline) {
      return
    }
    const regionBuf = this.regions.get(regionKey)?.buffers.get(bufferPassId ?? passId)
    if (!regionBuf || regionBuf.count === 0) {
      return
    }
    const desc = this.descriptors.find(d => d.id === passId)
    if (!desc) {
      return
    }

    this.ensurePickingTexture()
    if (!this.pickingTexture) {
      return
    }

    const encoder = this.device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.pickingTexture.createView(),
        loadOp: 'clear' as GPULoadOp,
        storeOp: 'store' as GPUStoreOp,
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
      }],
    })
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, regionBuf.bindGroup)
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
    if (px < 0 || px >= this.canvas.width || py < 0 || py >= this.canvas.height) {
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
      try { this.pickingStagingBuffer.unmap() } catch {}
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
    this.uniformBuffer.destroy()
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
    try { this.pickingStagingBuffer?.destroy() } catch {}
    this.pickingStagingBuffer = this.device.createBuffer({
      size: 256,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    })
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
