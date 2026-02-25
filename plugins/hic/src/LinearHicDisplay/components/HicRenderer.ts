/// <reference types="@webgpu/types" />

import getGpuDevice from '@jbrowse/core/gpu/getGpuDevice'
import { initGpuContext } from '@jbrowse/core/gpu/initGpuContext'

import { WebGLHicRenderer } from './WebGLHicRenderer.ts'
import { hicShader, interleaveHicInstances } from './hicShaders.ts'

import type { HicRenderState } from './WebGLHicRenderer.ts'

const UNIFORM_SIZE = 48

interface GpuData {
  instanceBuffer: GPUBuffer
  bindGroup: GPUBindGroup
  instanceCount: number
}

const rendererCache = new WeakMap<HTMLCanvasElement, HicRenderer>()

export class HicRenderer {
  private static device: GPUDevice | null = null
  private static pipeline: GPURenderPipeline | null = null
  private static bindGroupLayout: GPUBindGroupLayout | null = null

  private canvas: HTMLCanvasElement
  private context: GPUCanvasContext | null = null
  private uniformBuffer: GPUBuffer | null = null
  private uniformData = new ArrayBuffer(UNIFORM_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)
  private uniformU32 = new Uint32Array(this.uniformData)
  private gpuData: GpuData | null = null
  private rampTexture: GPUTexture | null = null
  private rampSampler: GPUSampler | null = null
  private glFallback: WebGLHicRenderer | null = null

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static getOrCreate(canvas: HTMLCanvasElement) {
    let renderer = rendererCache.get(canvas)
    if (!renderer) {
      renderer = new HicRenderer(canvas)
      rendererCache.set(canvas, renderer)
    }
    return renderer
  }

  private static async ensureDevice() {
    const device = await getGpuDevice()
    if (!device) {
      return null
    }
    if (HicRenderer.device !== device) {
      HicRenderer.device = device
      HicRenderer.initPipelines(device)
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

    HicRenderer.bindGroupLayout = device.createBindGroupLayout({
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
      bindGroupLayouts: [HicRenderer.bindGroupLayout],
    })
    const shaderModule = device.createShaderModule({ code: hicShader })

    HicRenderer.pipeline = device.createRenderPipeline({
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

  async init() {
    const device = await HicRenderer.ensureDevice()
    if (device) {
      const result = await initGpuContext(this.canvas)
      if (result) {
        this.context = result.context
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
        return true
      }
    }
    try {
      this.glFallback = new WebGLHicRenderer(this.canvas)
      return true
    } catch (e) {
      console.error('[HicRenderer] WebGL2 fallback also failed:', e)
      return false
    }
  }

  uploadData(data: {
    positions: Float32Array
    counts: Float32Array
    numContacts: number
  }) {
    if (this.glFallback) {
      this.glFallback.uploadData(data)
      return
    }

    const device = HicRenderer.device
    if (!device || !HicRenderer.bindGroupLayout || !this.uniformBuffer) {
      return
    }

    this.gpuData?.instanceBuffer.destroy()

    if (data.numContacts === 0) {
      this.gpuData = null
      return
    }

    const interleaved = interleaveHicInstances(data)
    const instanceBuffer = device.createBuffer({
      size: interleaved.byteLength || 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
    device.queue.writeBuffer(instanceBuffer, 0, interleaved)

    this.rebuildBindGroup(device, instanceBuffer, data.numContacts)
  }

  uploadColorRamp(colors: Uint8Array) {
    if (this.glFallback) {
      this.glFallback.uploadColorRamp(colors)
      return
    }

    const device = HicRenderer.device
    if (!device || !HicRenderer.bindGroupLayout || !this.uniformBuffer) {
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
      // @ts-expect-error Uint8Array<ArrayBufferLike> vs GPUAllowSharedBufferSource mismatch
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
    if (!this.rampTexture || !this.rampSampler || !this.uniformBuffer) {
      this.gpuData = { instanceBuffer, bindGroup: null!, instanceCount }
      return
    }

    const bindGroup = device.createBindGroup({
      layout: HicRenderer.bindGroupLayout!,
      entries: [
        { binding: 0, resource: { buffer: instanceBuffer } },
        { binding: 1, resource: { buffer: this.uniformBuffer } },
        { binding: 2, resource: this.rampTexture.createView() },
        { binding: 3, resource: this.rampSampler },
      ],
    })

    this.gpuData = { instanceBuffer, bindGroup, instanceCount }
  }

  render(state: HicRenderState) {
    if (this.glFallback) {
      this.glFallback.render(state)
      return
    }

    const device = HicRenderer.device
    if (
      !device ||
      !HicRenderer.pipeline ||
      !this.context ||
      !this.gpuData?.bindGroup
    ) {
      return
    }

    const {
      canvasWidth,
      canvasHeight,
      binWidth,
      yScalar,
      maxScore,
      useLogScale,
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
    this.uniformF32[2] = binWidth
    this.uniformF32[3] = yScalar
    this.uniformF32[4] = maxScore
    this.uniformF32[5] = viewScale
    this.uniformF32[6] = viewOffsetX
    this.uniformU32[7] = useLogScale ? 1 : 0
    device.queue.writeBuffer(this.uniformBuffer!, 0, this.uniformData)

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
    pass.setPipeline(HicRenderer.pipeline)
    pass.setBindGroup(0, this.gpuData.bindGroup)
    pass.setViewport(0, 0, bufW, bufH, 0, 1)
    pass.draw(6, this.gpuData.instanceCount)
    pass.end()
    device.queue.submit([encoder.finish()])
  }

  destroy() {
    if (this.glFallback) {
      this.glFallback.destroy()
      this.glFallback = null
    }
    this.gpuData?.instanceBuffer.destroy()
    this.gpuData = null
    this.rampTexture?.destroy()
    this.rampTexture = null
    rendererCache.delete(this.canvas)
  }
}

export { generateColorRamp } from './WebGLHicRenderer.ts'
