/// <reference types="@webgpu/types" />

import getGpuDevice from '@jbrowse/core/gpu/getGpuDevice'
import { initGpuContext } from '@jbrowse/core/gpu/initGpuContext'

import {
  interleaveMatrixInstances,
  variantMatrixShader,
} from './variantMatrixShaders.ts'

import type {
  MatrixRenderState,
  VariantMatrixBackend,
} from './variantMatrixBackendTypes.ts'

const UNIFORM_SIZE = 32

interface GpuData {
  instanceBuffer: GPUBuffer
  bindGroup: GPUBindGroup
  cellCount: number
}

export class WebGPUVariantMatrixRenderer implements VariantMatrixBackend {
  private static device: GPUDevice | null = null
  private static pipeline: GPURenderPipeline | null = null
  private static bindGroupLayout: GPUBindGroupLayout | null = null

  private canvas: HTMLCanvasElement
  private context: GPUCanvasContext
  private uniformBuffer: GPUBuffer
  private uniformData = new ArrayBuffer(UNIFORM_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)
  private gpuData: GpuData | null = null

  private constructor(
    canvas: HTMLCanvasElement,
    context: GPUCanvasContext,
    uniformBuffer: GPUBuffer,
  ) {
    this.canvas = canvas
    this.context = context
    this.uniformBuffer = uniformBuffer
  }

  static async create(canvas: HTMLCanvasElement) {
    const device = await WebGPUVariantMatrixRenderer.ensureDevice()
    if (!device) {
      return null
    }
    const result = await initGpuContext(canvas)
    if (!result) {
      return null
    }
    const uniformBuffer = device.createBuffer({
      size: UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    return new WebGPUVariantMatrixRenderer(
      canvas,
      result.context,
      uniformBuffer,
    )
  }

  private static async ensureDevice() {
    const device = await getGpuDevice()
    if (!device) {
      return null
    }
    if (WebGPUVariantMatrixRenderer.device !== device) {
      WebGPUVariantMatrixRenderer.device = device
      WebGPUVariantMatrixRenderer.initPipelines(device)
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

    WebGPUVariantMatrixRenderer.bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'read-only-storage' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'uniform' },
        },
      ],
    })

    const layout = device.createPipelineLayout({
      bindGroupLayouts: [WebGPUVariantMatrixRenderer.bindGroupLayout],
    })
    const shaderModule = device.createShaderModule({
      code: variantMatrixShader,
    })

    WebGPUVariantMatrixRenderer.pipeline = device.createRenderPipeline({
      layout,
      vertex: { module: shaderModule, entryPoint: 'vs_main' },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{ format: 'bgra8unorm', blend: blendState }],
      },
      primitive: { topology: 'triangle-list' },
    })
  }

  uploadCellData(data: {
    cellFeatureIndices: Float32Array
    cellRowIndices: Uint32Array
    cellColors: Uint8Array
    numCells: number
  }) {
    const device = WebGPUVariantMatrixRenderer.device
    if (!device || !WebGPUVariantMatrixRenderer.bindGroupLayout) {
      return
    }

    this.gpuData?.instanceBuffer.destroy()

    if (data.numCells === 0) {
      this.gpuData = null
      return
    }

    const interleaved = interleaveMatrixInstances(data)
    const instanceBuffer = device.createBuffer({
      size: interleaved.byteLength || 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
    device.queue.writeBuffer(instanceBuffer, 0, interleaved)

    const bindGroup = device.createBindGroup({
      layout: WebGPUVariantMatrixRenderer.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: instanceBuffer } },
        { binding: 1, resource: { buffer: this.uniformBuffer } },
      ],
    })

    this.gpuData = { instanceBuffer, bindGroup, cellCount: data.numCells }
  }

  render(state: MatrixRenderState) {
    const device = WebGPUVariantMatrixRenderer.device
    if (!device || !WebGPUVariantMatrixRenderer.pipeline) {
      return
    }

    const { canvasWidth, canvasHeight } = state
    const dpr = window.devicePixelRatio || 1
    const bufW = Math.round(canvasWidth * dpr)
    const bufH = Math.round(canvasHeight * dpr)

    if (this.canvas.width !== bufW || this.canvas.height !== bufH) {
      this.canvas.width = bufW
      this.canvas.height = bufH
    }

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

    if (this.gpuData && this.gpuData.cellCount > 0 && state.numFeatures > 0) {
      this.writeUniforms(device, state)
      pass.setPipeline(WebGPUVariantMatrixRenderer.pipeline)
      pass.setBindGroup(0, this.gpuData.bindGroup)
      pass.setViewport(0, 0, bufW, bufH, 0, 1)
      pass.draw(6, this.gpuData.cellCount)
    }

    pass.end()
    device.queue.submit([encoder.finish()])
  }

  private writeUniforms(device: GPUDevice, state: MatrixRenderState) {
    this.uniformF32[0] = state.numFeatures
    this.uniformF32[1] = state.canvasWidth
    this.uniformF32[2] = state.canvasHeight
    this.uniformF32[3] = state.rowHeight
    this.uniformF32[4] = state.scrollTop
    device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData)
  }

  dispose() {
    this.gpuData?.instanceBuffer.destroy()
    this.gpuData = null
  }
}
