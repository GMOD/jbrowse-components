/// <reference types="@webgpu/types" />

import getGpuDevice from '@jbrowse/core/gpu/getGpuDevice'
import { initGpuContext } from '@jbrowse/core/gpu/initGpuContext'

import { WebGLSyntenyRenderer } from './WebGLSyntenyRenderer.ts'
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
  private static pipelinesReady: Promise<void> | null = null

  private canvas: HTMLCanvasElement
  private glFallback: WebGLSyntenyRenderer | null = null
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
  private pickCallback?: (result: number) => void

  private get dpr() {
    return typeof window !== 'undefined' ? window.devicePixelRatio : 2
  }

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
      SyntenyRenderer.pipelinesReady = SyntenyRenderer.initPipelines(device)
    }
    await SyntenyRenderer.pipelinesReady
    return device
  }

  private static async initPipelines(device: GPUDevice) {
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
    const edgeModule = device.createShaderModule({ code: edgeVertexShader })

    ;[
      SyntenyRenderer.fillPipeline,
      SyntenyRenderer.fillPickingPipeline,
      SyntenyRenderer.edgePipeline,
    ] = await Promise.all([
      device.createRenderPipelineAsync({
        layout,
        vertex: { module: fillModule, entryPoint: 'vs_main' },
        fragment: {
          module: fillModule,
          entryPoint: 'fs_main',
          targets: [{ format: 'bgra8unorm', blend: blendState }],
        },
        primitive: { topology: 'triangle-list' },
      }),
      device.createRenderPipelineAsync({
        layout,
        vertex: { module: fillModule, entryPoint: 'vs_main' },
        fragment: {
          module: fillModule,
          entryPoint: 'fs_picking',
          targets: [{ format: 'rgba8unorm' }],
        },
        primitive: { topology: 'triangle-list' },
      }),
      device.createRenderPipelineAsync({
        layout,
        vertex: { module: edgeModule, entryPoint: 'vs_main' },
        fragment: {
          module: edgeModule,
          entryPoint: 'fs_main',
          targets: [{ format: 'bgra8unorm', blend: blendState }],
        },
        primitive: { topology: 'triangle-list' },
      }),
    ])
  }

  async init() {
    const device = await SyntenyRenderer.ensureDevice()
    if (device) {
      const result = await initGpuContext(this.canvas, { alphaMode: 'opaque' })
      if (result) {
        this.context = result.context
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
    }
    try {
      this.glFallback = new WebGLSyntenyRenderer(this.canvas)
      return true
    } catch (e) {
      console.error('[SyntenyRenderer] WebGL2 fallback also failed:', e)
      return false
    }
  }

  resize(width: number, height: number) {
    if (this.glFallback) {
      this.glFallback.resize(width, height)
      return
    }
    const dpr = this.dpr
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
    if (this.glFallback) {
      this.glFallback.uploadGeometry(data)
      return
    }
    const device = SyntenyRenderer.device
    if (!device || !SyntenyRenderer.bindGroupLayout || !this.uniformBuffer) {
      return
    }

    this.instanceCount = data.instanceCount
    this.nonCigarInstanceCount = data.nonCigarInstanceCount
    this.geometryBpPerPx0 = data.geometryBpPerPx0
    this.geometryBpPerPx1 = data.geometryBpPerPx1
    this.refOffset0 = data.refOffset0
    this.refOffset1 = data.refOffset1

    const interleaved = this.interleaveInstances(data)

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
    if (this.glFallback) {
      this.glFallback.render(
        offset0,
        offset1,
        height,
        curBpPerPx0,
        curBpPerPx1,
        maxOffScreenPx,
        minAlignmentLength,
        alpha,
        hoveredFeatureId,
        clickedFeatureId,
      )
      return
    }
    const device = SyntenyRenderer.device
    if (
      !device ||
      !this.instanceBuffer ||
      this.instanceCount === 0 ||
      !this.bindGroup ||
      !SyntenyRenderer.fillPipeline ||
      !this.context
    ) {
      return
    }

    const scale0 = this.geometryBpPerPx0 / curBpPerPx0
    const scale1 = this.geometryBpPerPx1 / curBpPerPx1
    const adjOff0 = offset0 / scale0 - this.refOffset0
    const adjOff1 = offset1 / scale1 - this.refOffset1

    const { dpr } = this
    const logicalW = this.canvas.width / dpr
    const logicalH = this.canvas.height / dpr

    this.writeUniforms(
      logicalW,
      logicalH,
      height,
      adjOff0,
      adjOff1,
      scale0,
      scale1,
      maxOffScreenPx,
      minAlignmentLength,
      alpha,
      hoveredFeatureId,
      clickedFeatureId,
    )

    this.lastRenderParams = {
      height,
      adjOff0,
      adjOff1,
      scale0,
      scale1,
      maxOffScreenPx,
      minAlignmentLength,
      alpha,
      hoveredFeatureId,
      clickedFeatureId,
    }
    this.pickingDirty = true

    const encoder = device.createCommandEncoder()
    const tv = this.context.getCurrentTexture().createView()
    const white = { r: 1, g: 1, b: 1, a: 1 }

    this.encodeDrawPass(
      encoder,
      tv,
      SyntenyRenderer.fillPipeline,
      FILL_VERTS_PER_INSTANCE,
      'clear',
      white,
    )
    if (SyntenyRenderer.edgePipeline && clickedFeatureId > 0) {
      this.encodeDrawPass(
        encoder,
        tv,
        SyntenyRenderer.edgePipeline,
        EDGE_VERTS_PER_INSTANCE,
        'load',
        undefined,
        this.nonCigarInstanceCount,
      )
    }
    device.queue.submit([encoder.finish()])
  }

  pick(
    x: number,
    y: number,
    onResult?: (result: number) => void,
  ): number | undefined {
    if (this.glFallback) {
      return this.glFallback.pick(x, y, onResult)
    }
    this.pickCallback = onResult
    if (this.pendingPick) {
      return undefined
    }
    this.pendingPick = true
    this.doPick(x, y).then(
      result => {
        this.cachedPickResult = result
        this.pendingPick = false
        this.pickCallback?.(result)
      },
      () => {
        this.pendingPick = false
      },
    )
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

    const { dpr } = this

    if (this.pickingDirty) {
      const p = this.lastRenderParams
      this.writeUniforms(
        this.canvas.width / dpr,
        this.canvas.height / dpr,
        p.height,
        p.adjOff0,
        p.adjOff1,
        p.scale0,
        p.scale1,
        p.maxOffScreenPx,
        p.minAlignmentLength,
        1,
        0,
        0,
      )

      const encoder = device.createCommandEncoder()
      const pv = this.pickingTexture.createView()
      const transparent = { r: 0, g: 0, b: 0, a: 0 }
      this.encodeDrawPass(
        encoder,
        pv,
        SyntenyRenderer.fillPickingPipeline,
        FILL_VERTS_PER_INSTANCE,
        'clear',
        transparent,
      )
      device.queue.submit([encoder.finish()])
      this.pickingDirty = false
    }
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

    const stagingBuffer = this.pickingStagingBuffer

    const encoder = device.createCommandEncoder()
    encoder.copyTextureToBuffer(
      { texture: this.pickingTexture, origin: [px, py, 0] },
      { buffer: stagingBuffer, bytesPerRow: 256 },
      [1, 1, 1],
    )
    device.queue.submit([encoder.finish()])

    try {
      await stagingBuffer.mapAsync(GPUMapMode.READ)
    } catch {
      this.resetStagingBuffer()
      return -1
    }

    if (stagingBuffer !== this.pickingStagingBuffer) {
      try {
        stagingBuffer.unmap()
      } catch {}
      return -1
    }

    let result = -1
    try {
      const data = new Uint8Array(stagingBuffer.getMappedRange())
      const r = data[0]!
      const g = data[1]!
      const b = data[2]!
      result = r === 0 && g === 0 && b === 0 ? -1 : r + g * 256 + b * 65536 - 1
    } catch {
      this.resetStagingBuffer()
    } finally {
      try {
        stagingBuffer.unmap()
      } catch {}
    }
    return result
  }

  private resetStagingBuffer() {
    const device = SyntenyRenderer.device
    if (!device) {
      return
    }
    try {
      this.pickingStagingBuffer?.destroy()
    } catch {}
    this.pickingStagingBuffer = device.createBuffer({
      size: 256,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    })
  }

  dispose() {
    if (this.glFallback) {
      this.glFallback.dispose()
      this.glFallback = null
      return
    }
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
    logicalW: number,
    logicalH: number,
    height: number,
    adjOff0: number,
    adjOff1: number,
    scale0: number,
    scale1: number,
    maxOffScreenPx: number,
    minAlignmentLength: number,
    alpha: number,
    hoveredFeatureId: number,
    clickedFeatureId: number,
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

  private interleaveInstances(data: SyntenyInstanceData) {
    const {
      x1,
      x2,
      x3,
      x4,
      colors,
      featureIds,
      isCurves,
      queryTotalLengths,
      padTops,
      padBottoms,
      instanceCount: n,
    } = data
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
