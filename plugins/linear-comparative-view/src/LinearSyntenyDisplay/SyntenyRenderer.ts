/// <reference types="@webgpu/types" />

import getGpuDevice from '@jbrowse/core/gpu/getGpuDevice'

import {
  EDGE_SEGMENTS,
  EDGE_VERTS_PER_INSTANCE,
  FILL_SEGMENTS,
  FILL_VERTS_PER_INSTANCE,
  INSTANCE_BYTE_SIZE,
  edgeVertexShader,
  fillVertexShader,
} from './syntenyShaders.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/executeSyntenyInstanceData.ts'

const UNIFORM_SIZE = 64

const rendererCache = new WeakMap<HTMLCanvasElement, SyntenyRenderer>()

export class SyntenyRenderer {
  private static device: GPUDevice | null = null
  private static fillPipeline: GPURenderPipeline | null = null
  private static fillPickingPipeline: GPURenderPipeline | null = null
  private static edgePipeline: GPURenderPipeline | null = null
  private static bindGroupLayout: GPUBindGroupLayout | null = null

  private canvas: HTMLCanvasElement
  private context: GPUCanvasContext | null = null
  private uniformBuffer: GPUBuffer | null = null
  private uniformData = new ArrayBuffer(UNIFORM_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)
  private uniformU32 = new Uint32Array(this.uniformData)

  private instanceBuffer: GPUBuffer | null = null
  private bindGroup: GPUBindGroup | null = null
  private instanceCount = 0
  private nonCigarInstanceCount = 0
  private geometryBpPerPx0 = 1
  private geometryBpPerPx1 = 1
  private refOffset0 = 0
  private refOffset1 = 0

  private pickingTexture: GPUTexture | null = null
  private pickingStagingBuffer: GPUBuffer | null = null
  private pickingDirty = true
  private lastRenderParams = {
    height: 0,
    adjOff0: 0,
    adjOff1: 0,
    scale0: 1,
    scale1: 1,
    maxOffScreenPx: 300,
    minAlignmentLength: 0,
    alpha: 1,
    hoveredFeatureId: 0,
    clickedFeatureId: 0,
  }

  private cachedPickResult = -1
  private pendingPick = false

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static getOrCreate(canvas: HTMLCanvasElement) {
    let renderer = rendererCache.get(canvas)
    if (!renderer) {
      renderer = new SyntenyRenderer(canvas)
      rendererCache.set(canvas, renderer)
    }
    return renderer
  }

  private static async ensureDevice() {
    const device = await getGpuDevice()
    if (!device) {
      return null
    }
    if (SyntenyRenderer.device !== device) {
      SyntenyRenderer.device = device
      SyntenyRenderer.initPipelines(device)
    }
    return device
  }

  private static initPipelines(device: GPUDevice) {
    SyntenyRenderer.bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'read-only-storage' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    })

    const layout = device.createPipelineLayout({
      bindGroupLayouts: [SyntenyRenderer.bindGroupLayout],
    })

    const blendState: GPUBlendState = {
      color: {
        srcFactor: 'src-alpha',
        dstFactor: 'one-minus-src-alpha',
        operation: 'add',
      },
      alpha: {
        srcFactor: 'one',
        dstFactor: 'one-minus-src-alpha',
        operation: 'add',
      },
    }

    const fillModule = device.createShaderModule({ code: fillVertexShader })
    SyntenyRenderer.fillPipeline = device.createRenderPipeline({
      layout,
      vertex: { module: fillModule, entryPoint: 'vs_main' },
      fragment: {
        module: fillModule,
        entryPoint: 'fs_main',
        targets: [{ format: 'bgra8unorm', blend: blendState }],
      },
      primitive: { topology: 'triangle-list' },
    })

    SyntenyRenderer.fillPickingPipeline = device.createRenderPipeline({
      layout,
      vertex: { module: fillModule, entryPoint: 'vs_main' },
      fragment: {
        module: fillModule,
        entryPoint: 'fs_picking',
        targets: [{ format: 'rgba8unorm' }],
      },
      primitive: { topology: 'triangle-list' },
    })

    const edgeModule = device.createShaderModule({ code: edgeVertexShader })
    SyntenyRenderer.edgePipeline = device.createRenderPipeline({
      layout,
      vertex: { module: edgeModule, entryPoint: 'vs_main' },
      fragment: {
        module: edgeModule,
        entryPoint: 'fs_main',
        targets: [{ format: 'bgra8unorm', blend: blendState }],
      },
      primitive: { topology: 'triangle-list' },
    })
  }

  async init() {
    const device = await SyntenyRenderer.ensureDevice()
    if (!device) {
      return false
    }

    this.context = this.canvas.getContext('webgpu')!
    this.context.configure({
      device,
      format: 'bgra8unorm',
      alphaMode: 'opaque',
    })

    this.uniformBuffer = device.createBuffer({
      size: UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    this.pickingStagingBuffer = device.createBuffer({
      size: 256,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    })

    return true
  }

  resize(width: number, height: number, dpr = 2) {
    const pw = Math.round(width * dpr)
    const ph = Math.round(height * dpr)
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw
      this.canvas.height = ph
      this.createPickingTexture(pw, ph)
    }
  }

  private createPickingTexture(w: number, h: number) {
    const device = SyntenyRenderer.device
    if (!device || w === 0 || h === 0) {
      return
    }
    this.pickingTexture?.destroy()
    this.pickingTexture = device.createTexture({
      size: [w, h],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    })
  }

  uploadGeometry(data: SyntenyInstanceData) {
    const device = SyntenyRenderer.device
    if (!device || !SyntenyRenderer.bindGroupLayout || !this.uniformBuffer) {
      return
    }

    this.instanceCount = data.instanceCount
    this.nonCigarInstanceCount = data.nonCigarInstanceCount ?? data.instanceCount
    this.geometryBpPerPx0 = data.geometryBpPerPx0
    this.geometryBpPerPx1 = data.geometryBpPerPx1
    this.refOffset0 = data.refOffset0 ?? 0
    this.refOffset1 = data.refOffset1 ?? 0

    const interleaved = this.interleaveInstances(
      data.x1, data.x2, data.x3, data.x4,
      data.colors, data.featureIds, data.isCurves,
      data.queryTotalLengths, data.padTops, data.padBottoms,
      data.instanceCount,
    )

    this.instanceBuffer?.destroy()
    this.instanceBuffer = device.createBuffer({
      size: interleaved.byteLength || 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
    device.queue.writeBuffer(this.instanceBuffer, 0, interleaved)

    this.bindGroup = device.createBindGroup({
      layout: SyntenyRenderer.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.instanceBuffer } },
        { binding: 1, resource: { buffer: this.uniformBuffer } },
      ],
    })
    this.pickingDirty = true
  }

  render(
    offset0: number,
    offset1: number,
    height: number,
    curBpPerPx0: number,
    curBpPerPx1: number,
    maxOffScreenPx: number,
    minAlignmentLength: number,
    alpha: number,
    hoveredFeatureId: number,
    clickedFeatureId: number,
  ) {
    const device = SyntenyRenderer.device
    if (!device || !this.instanceBuffer || this.instanceCount === 0) {
      return
    }
    if (!this.bindGroup || !SyntenyRenderer.fillPipeline || !this.context) {
      return
    }

    const scale0 = this.geometryBpPerPx0 / curBpPerPx0
    const scale1 = this.geometryBpPerPx1 / curBpPerPx1
    const adjOff0 = offset0 / scale0 - this.refOffset0
    const adjOff1 = offset1 / scale1 - this.refOffset1

    const w = this.canvas.width
    const h = this.canvas.height
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 2
    const logicalW = w / dpr
    const logicalH = h / dpr

    this.writeUniforms(logicalW, logicalH, height, adjOff0, adjOff1, scale0, scale1, maxOffScreenPx, minAlignmentLength, alpha, hoveredFeatureId, clickedFeatureId)

    this.lastRenderParams = {
      height, adjOff0, adjOff1, scale0, scale1,
      maxOffScreenPx, minAlignmentLength, alpha,
      hoveredFeatureId, clickedFeatureId,
    }
    this.pickingDirty = true

    const encoder = device.createCommandEncoder()
    const tv = this.context.getCurrentTexture().createView()
    const white = { r: 1, g: 1, b: 1, a: 1 }

    this.encodeDrawPass(encoder, tv, SyntenyRenderer.fillPipeline, FILL_VERTS_PER_INSTANCE, 'clear', white)
    if (SyntenyRenderer.edgePipeline && clickedFeatureId > 0) {
      this.encodeDrawPass(encoder, tv, SyntenyRenderer.edgePipeline, EDGE_VERTS_PER_INSTANCE, 'load', undefined, this.nonCigarInstanceCount)
    }
    device.queue.submit([encoder.finish()])
  }

  pick(x: number, y: number) {
    if (this.pendingPick) {
      return this.cachedPickResult
    }
    this.pendingPick = true
    this.doPick(x, y).then(result => {
      this.cachedPickResult = result
      this.pendingPick = false
    })
    return this.cachedPickResult
  }

  private async doPick(x: number, y: number) {
    const device = SyntenyRenderer.device
    if (
      !device ||
      !this.instanceBuffer ||
      this.instanceCount === 0 ||
      !this.pickingTexture ||
      !this.pickingStagingBuffer ||
      !SyntenyRenderer.fillPickingPipeline ||
      !this.bindGroup
    ) {
      return -1
    }

    if (this.pickingDirty) {
      const p = this.lastRenderParams
      const w = this.canvas.width
      const h = this.canvas.height
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 2
      this.writeUniforms(w / dpr, h / dpr, p.height, p.adjOff0, p.adjOff1, p.scale0, p.scale1, p.maxOffScreenPx, p.minAlignmentLength, 1, 0, 0)

      const encoder = device.createCommandEncoder()
      const pv = this.pickingTexture.createView()
      const transparent = { r: 0, g: 0, b: 0, a: 0 }
      this.encodeDrawPass(encoder, pv, SyntenyRenderer.fillPickingPipeline, FILL_VERTS_PER_INSTANCE, 'clear', transparent)
      device.queue.submit([encoder.finish()])
      this.pickingDirty = false
    }

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 2
    const px = Math.floor(x * dpr)
    const py = Math.floor(y * dpr)

    if (px < 0 || px >= this.canvas.width || py < 0 || py >= this.canvas.height) {
      return -1
    }

    const encoder = device.createCommandEncoder()
    encoder.copyTextureToBuffer(
      { texture: this.pickingTexture, origin: [px, py, 0] },
      { buffer: this.pickingStagingBuffer, bytesPerRow: 256 },
      [1, 1, 1],
    )
    device.queue.submit([encoder.finish()])

    await this.pickingStagingBuffer.mapAsync(GPUMapMode.READ)
    const data = new Uint8Array(this.pickingStagingBuffer.getMappedRange())
    const r = data[0]!
    const g = data[1]!
    const b = data[2]!
    this.pickingStagingBuffer.unmap()

    return r === 0 && g === 0 && b === 0 ? -1 : r + g * 256 + b * 65536 - 1
  }

  dispose() {
    this.instanceBuffer?.destroy()
    this.instanceBuffer = null
    this.bindGroup = null
    this.uniformBuffer?.destroy()
    this.uniformBuffer = null
    this.pickingTexture?.destroy()
    this.pickingTexture = null
    this.pickingStagingBuffer?.destroy()
    this.pickingStagingBuffer = null
    this.context = null
  }

  private writeUniforms(
    logicalW: number, logicalH: number,
    height: number, adjOff0: number, adjOff1: number,
    scale0: number, scale1: number,
    maxOffScreenPx: number, minAlignmentLength: number,
    alpha: number, hoveredFeatureId: number, clickedFeatureId: number,
  ) {
    const device = SyntenyRenderer.device
    if (!device || !this.uniformBuffer) {
      return
    }
    this.uniformF32[0] = logicalW
    this.uniformF32[1] = logicalH
    this.uniformF32[2] = height
    this.uniformF32[3] = adjOff0
    this.uniformF32[4] = adjOff1
    this.uniformF32[5] = scale0
    this.uniformF32[6] = scale1
    this.uniformF32[7] = maxOffScreenPx
    this.uniformF32[8] = minAlignmentLength
    this.uniformF32[9] = alpha
    this.uniformU32[10] = this.instanceCount
    this.uniformU32[11] = FILL_SEGMENTS
    this.uniformU32[12] = EDGE_SEGMENTS
    this.uniformF32[13] = hoveredFeatureId
    this.uniformF32[14] = clickedFeatureId
    this.uniformF32[15] = 0
    device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData)
  }

  private encodeDrawPass(
    encoder: GPUCommandEncoder,
    view: GPUTextureView,
    pipeline: GPURenderPipeline,
    vertexCount: number,
    loadOp: GPULoadOp,
    clearValue?: GPUColor,
    drawInstanceCount?: number,
  ) {
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          loadOp,
          storeOp: 'store' as GPUStoreOp,
          ...(clearValue && { clearValue }),
        },
      ],
    })
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, this.bindGroup)
    pass.draw(vertexCount, drawInstanceCount ?? this.instanceCount)
    pass.end()
  }

  private interleaveInstances(
    x1: Float32Array, x2: Float32Array, x3: Float32Array, x4: Float32Array,
    colors: Float32Array, featureIds: Float32Array, isCurves: Float32Array,
    queryTotalLengths: Float32Array, padTops: Float32Array, padBottoms: Float32Array,
    n: number,
  ) {
    const buf = new ArrayBuffer(n * INSTANCE_BYTE_SIZE)
    const f = new Float32Array(buf)
    const stride = INSTANCE_BYTE_SIZE / 4

    for (let i = 0; i < n; i++) {
      const off = i * stride
      f[off] = x1[i]!
      f[off + 1] = x2[i]!
      f[off + 2] = x3[i]!
      f[off + 3] = x4[i]!
      f[off + 4] = colors[i * 4]!
      f[off + 5] = colors[i * 4 + 1]!
      f[off + 6] = colors[i * 4 + 2]!
      f[off + 7] = colors[i * 4 + 3]!
      f[off + 8] = featureIds[i]!
      f[off + 9] = isCurves[i]!
      f[off + 10] = queryTotalLengths[i]!
      f[off + 11] = padTops[i]!
      f[off + 12] = padBottoms[i]!
      f[off + 13] = 0
      f[off + 14] = 0
      f[off + 15] = 0
    }
    return buf
  }
}
