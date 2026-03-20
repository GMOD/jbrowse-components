/// <reference types="@webgpu/types" />

import getGpuDevice from '@jbrowse/core/gpu/getGpuDevice'
import { initGpuContext } from '@jbrowse/core/gpu/initGpuContext'

import {
  INSTANCE_BYTE_SIZE,
  VERTS_PER_INSTANCE,
  dotplotShader,
} from './dotplotShaders.ts'

import type {
  DotplotBackend,
  DotplotGeometryData,
} from './dotplotBackendTypes.ts'

const UNIFORM_SIZE = 32

export class WebGPUDotplotRenderer implements DotplotBackend {
  private static device: GPUDevice | null = null
  private static pipeline: GPURenderPipeline | null = null
  private static bindGroupLayout: GPUBindGroupLayout | null = null

  private canvas: HTMLCanvasElement
  private context: GPUCanvasContext
  private uniformBuffer: GPUBuffer
  private uniformData = new ArrayBuffer(UNIFORM_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)
  private instanceBuffer: GPUBuffer | null = null
  private bindGroup: GPUBindGroup | null = null
  private instanceCount = 0

  private constructor(
    canvas: HTMLCanvasElement,
    context: GPUCanvasContext,
    device: GPUDevice,
  ) {
    this.canvas = canvas
    this.context = context
    this.uniformBuffer = device.createBuffer({
      size: UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
  }

  static async create(canvas: HTMLCanvasElement) {
    const device = await WebGPUDotplotRenderer.ensureDevice()
    if (!device) {
      return null
    }
    const result = await initGpuContext(canvas)
    if (!result) {
      return null
    }
    return new WebGPUDotplotRenderer(canvas, result.context, device)
  }

  private static async ensureDevice() {
    const device = await getGpuDevice()
    if (!device) {
      return null
    }
    if (WebGPUDotplotRenderer.device !== device) {
      WebGPUDotplotRenderer.device = device
      WebGPUDotplotRenderer.initPipelines(device)
    }
    return device
  }

  private static initPipelines(device: GPUDevice) {
    const blendState: GPUBlendState = {
      color: {
        srcFactor: 'one',
        dstFactor: 'one-minus-src-alpha',
        operation: 'add',
      },
      alpha: {
        srcFactor: 'one',
        dstFactor: 'one-minus-src-alpha',
        operation: 'add',
      },
    }

    WebGPUDotplotRenderer.bindGroupLayout = device.createBindGroupLayout({
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
      bindGroupLayouts: [WebGPUDotplotRenderer.bindGroupLayout],
    })

    const module = device.createShaderModule({ code: dotplotShader })
    WebGPUDotplotRenderer.pipeline = device.createRenderPipeline({
      layout,
      vertex: { module, entryPoint: 'vs_main' },
      fragment: {
        module,
        entryPoint: 'fs_main',
        targets: [{ format: 'bgra8unorm', blend: blendState }],
      },
      primitive: { topology: 'triangle-list' },
    })
  }

  resize(width: number, height: number) {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1
    const pw = Math.round(width * dpr)
    const ph = Math.round(height * dpr)
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw
      this.canvas.height = ph
    }
  }

  uploadGeometry(data: DotplotGeometryData) {
    const device = WebGPUDotplotRenderer.device
    if (!device || !WebGPUDotplotRenderer.bindGroupLayout) {
      return
    }

    this.instanceBuffer?.destroy()
    this.instanceCount = data.instanceCount

    if (data.instanceCount === 0) {
      this.instanceBuffer = null
      this.bindGroup = null
      return
    }

    const n = data.instanceCount
    const buf = new ArrayBuffer(n * INSTANCE_BYTE_SIZE)
    const f = new Float32Array(buf)
    const stride = INSTANCE_BYTE_SIZE / 4

    for (let i = 0; i < n; i++) {
      const off = i * stride
      f[off] = data.x1s[i]!
      f[off + 1] = data.y1s[i]!
      f[off + 2] = data.x2s[i]!
      f[off + 3] = data.y2s[i]!
      f[off + 4] = data.colors[i * 4]!
      f[off + 5] = data.colors[i * 4 + 1]!
      f[off + 6] = data.colors[i * 4 + 2]!
      f[off + 7] = data.colors[i * 4 + 3]!
    }

    this.instanceBuffer = device.createBuffer({
      size: buf.byteLength || 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
    device.queue.writeBuffer(this.instanceBuffer, 0, buf)

    this.bindGroup = device.createBindGroup({
      layout: WebGPUDotplotRenderer.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.instanceBuffer } },
        { binding: 1, resource: { buffer: this.uniformBuffer } },
      ],
    })
  }

  render(
    offsetX: number,
    offsetY: number,
    lineWidth: number,
    scaleX: number,
    scaleY: number,
  ) {
    const device = WebGPUDotplotRenderer.device
    if (!device || !WebGPUDotplotRenderer.pipeline) {
      return
    }
    if (!this.instanceBuffer || !this.bindGroup || this.instanceCount === 0) {
      this.clearCanvas(device)
      return
    }

    const w = this.canvas.width
    const h = this.canvas.height
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1
    const logicalW = w / dpr
    const logicalH = h / dpr

    this.uniformF32[0] = logicalW
    this.uniformF32[1] = logicalH
    this.uniformF32[2] = offsetX
    this.uniformF32[3] = offsetY
    this.uniformF32[4] = lineWidth
    this.uniformF32[5] = scaleX
    this.uniformF32[6] = scaleY
    this.uniformF32[7] = 0
    device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData)

    const textureView = this.context.getCurrentTexture().createView()
    const encoder = device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          loadOp: 'clear' as GPULoadOp,
          storeOp: 'store' as GPUStoreOp,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
        },
      ],
    })
    pass.setPipeline(WebGPUDotplotRenderer.pipeline)
    pass.setBindGroup(0, this.bindGroup)
    pass.draw(VERTS_PER_INSTANCE, this.instanceCount)
    pass.end()
    device.queue.submit([encoder.finish()])
  }

  dispose() {
    this.instanceBuffer?.destroy()
    this.instanceBuffer = null
    this.bindGroup = null
    this.uniformBuffer.destroy()
  }

  private clearCanvas(device: GPUDevice) {
    const textureView = this.context.getCurrentTexture().createView()
    const encoder = device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          loadOp: 'clear' as GPULoadOp,
          storeOp: 'store' as GPUStoreOp,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
        },
      ],
    })
    pass.end()
    device.queue.submit([encoder.finish()])
  }
}
