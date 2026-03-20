/// <reference types="@webgpu/types" />

import getGpuDevice from '@jbrowse/core/gpu/getGpuDevice'
import { initGpuContext } from '@jbrowse/core/gpu/initGpuContext'

import { interleaveLDInstances, ldShader } from './ldShaders.ts'

import type { LDBackend, LDRenderState } from './ldBackendTypes.ts'

const UNIFORM_SIZE = 32

interface GpuData {
  instanceBuffer: GPUBuffer
  bindGroup: GPUBindGroup
  instanceCount: number
}

export class WebGPULDRenderer implements LDBackend {
  private static device: GPUDevice | null = null
  private static pipeline: GPURenderPipeline | null = null
  private static bindGroupLayout: GPUBindGroupLayout | null = null

  private canvas: HTMLCanvasElement
  private context: GPUCanvasContext
  private uniformBuffer: GPUBuffer
  private uniformData = new ArrayBuffer(UNIFORM_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)
  private uniformU32 = new Uint32Array(this.uniformData)
  private gpuData: GpuData | null = null
  private rampTexture: GPUTexture | null = null
  private rampSampler: GPUSampler

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
    this.rampSampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    })
  }

  static async create(canvas: HTMLCanvasElement) {
    const device = await WebGPULDRenderer.ensureDevice()
    if (!device) {
      return null
    }
    const result = await initGpuContext(canvas)
    if (!result) {
      return null
    }
    return new WebGPULDRenderer(canvas, result.context, device)
  }

  private static async ensureDevice() {
    const device = await getGpuDevice()
    if (!device) {
      return null
    }
    if (WebGPULDRenderer.device !== device) {
      WebGPULDRenderer.device = device
      WebGPULDRenderer.initPipelines(device)
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

    WebGPULDRenderer.bindGroupLayout = device.createBindGroupLayout({
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

    const layout = device.createPipelineLayout({
      bindGroupLayouts: [WebGPULDRenderer.bindGroupLayout],
    })
    const shaderModule = device.createShaderModule({ code: ldShader })

    WebGPULDRenderer.pipeline = device.createRenderPipeline({
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

  uploadData(data: {
    positions: Float32Array
    cellSizes: Float32Array
    ldValues: Float32Array
    numCells: number
  }) {
    const device = WebGPULDRenderer.device
    if (!device || !WebGPULDRenderer.bindGroupLayout) {
      return
    }

    this.gpuData?.instanceBuffer.destroy()

    if (data.numCells === 0) {
      this.gpuData = null
      return
    }

    const interleaved = interleaveLDInstances(data)
    const instanceBuffer = device.createBuffer({
      size: interleaved.byteLength || 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
    device.queue.writeBuffer(instanceBuffer, 0, interleaved)

    this.rebuildBindGroup(device, instanceBuffer, data.numCells)
  }

  uploadColorRamp(colors: Uint8Array) {
    const device = WebGPULDRenderer.device
    if (!device || !WebGPULDRenderer.bindGroupLayout) {
      return
    }

    if (this.rampTexture) {
      this.rampTexture.destroy()
    }

    this.rampTexture = device.createTexture({
      size: [256, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    })
    device.queue.writeTexture(
      { texture: this.rampTexture },
      colors,
      { bytesPerRow: 256 * 4 },
      { width: 256, height: 1 },
    )

    if (this.gpuData) {
      this.rebuildBindGroup(
        device,
        this.gpuData.instanceBuffer,
        this.gpuData.instanceCount,
      )
    }
  }

  private rebuildBindGroup(
    device: GPUDevice,
    instanceBuffer: GPUBuffer,
    instanceCount: number,
  ) {
    if (!this.rampTexture) {
      this.gpuData = { instanceBuffer, bindGroup: null!, instanceCount }
      return
    }

    const bindGroup = device.createBindGroup({
      layout: WebGPULDRenderer.bindGroupLayout!,
      entries: [
        { binding: 0, resource: { buffer: instanceBuffer } },
        { binding: 1, resource: { buffer: this.uniformBuffer } },
        { binding: 2, resource: this.rampTexture.createView() },
        { binding: 3, resource: this.rampSampler },
      ],
    })

    this.gpuData = { instanceBuffer, bindGroup, instanceCount }
  }

  render(state: LDRenderState) {
    const device = WebGPULDRenderer.device
    if (!device || !WebGPULDRenderer.pipeline || !this.gpuData?.bindGroup) {
      return
    }

    const {
      canvasWidth,
      canvasHeight,
      yScalar,
      signedLD,
      viewScale,
      viewOffsetX,
    } = state

    const dpr = window.devicePixelRatio || 1
    const bufW = Math.round(canvasWidth * dpr)
    const bufH = Math.round(canvasHeight * dpr)

    if (this.canvas.width !== bufW || this.canvas.height !== bufH) {
      this.canvas.width = bufW
      this.canvas.height = bufH
    }

    this.uniformF32[0] = canvasWidth
    this.uniformF32[1] = canvasHeight
    this.uniformF32[2] = yScalar
    this.uniformF32[3] = viewScale
    this.uniformF32[4] = viewOffsetX
    this.uniformU32[5] = signedLD ? 1 : 0
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
    pass.setPipeline(WebGPULDRenderer.pipeline)
    pass.setBindGroup(0, this.gpuData.bindGroup)
    pass.setViewport(0, 0, bufW, bufH, 0, 1)
    pass.draw(6, this.gpuData.instanceCount)
    pass.end()
    device.queue.submit([encoder.finish()])
  }

  dispose() {
    this.gpuData?.instanceBuffer.destroy()
    this.gpuData = null
    this.rampTexture?.destroy()
    this.rampTexture = null
  }
}
