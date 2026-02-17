/// <reference types="@webgpu/types" />

import {
  INSTANCE_STRIDE,
  wiggleShader,
} from './wiggleShaders.ts'
import { WebGLWiggleRenderer } from './WebGLWiggleRenderer.ts'

import type { RenderingType } from './WebGLWiggleRenderer.ts'

const UNIFORM_SIZE = 96
const INSTANCE_BYTES = INSTANCE_STRIDE * 4

const RENDERING_TYPE_MAP: Record<number, RenderingType> = {
  0: 'xyplot',
  1: 'density',
  2: 'line',
}

interface GpuRegionData {
  regionStart: number
  featureCount: number
  instanceBuffer: GPUBuffer
  bindGroup: GPUBindGroup
}

export interface WiggleGPURenderState {
  domainY: [number, number]
  scaleType: number
  renderingType: number
  useBicolor: number
  bicolorPivot: number
  color: [number, number, number]
  posColor: [number, number, number]
  negColor: [number, number, number]
  canvasWidth: number
  canvasHeight: number
}

export interface WiggleRenderBlock {
  regionNumber: number
  bpRangeX: [number, number]
  screenStartPx: number
  screenEndPx: number
}

const rendererCache = new WeakMap<HTMLCanvasElement, WiggleRenderer>()

export class WiggleRenderer {
  private static device: GPUDevice | null = null
  private static devicePromise: Promise<GPUDevice | null> | null = null
  private static fillPipeline: GPURenderPipeline | null = null
  private static linePipeline: GPURenderPipeline | null = null
  private static bindGroupLayout: GPUBindGroupLayout | null = null

  private canvas: HTMLCanvasElement
  private context: GPUCanvasContext | null = null
  private uniformBuffer: GPUBuffer | null = null
  private uniformData = new ArrayBuffer(UNIFORM_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)
  private uniformI32 = new Int32Array(this.uniformData)
  private uniformU32 = new Uint32Array(this.uniformData)
  private regions = new Map<number, GpuRegionData>()
  private glFallback: WebGLWiggleRenderer | null = null

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static getOrCreate(canvas: HTMLCanvasElement) {
    let renderer = rendererCache.get(canvas)
    if (!renderer) {
      renderer = new WiggleRenderer(canvas)
      rendererCache.set(canvas, renderer)
    }
    return renderer
  }

  private static async ensureDevice() {
    if (WiggleRenderer.device) {
      return WiggleRenderer.device
    }
    if (WiggleRenderer.devicePromise) {
      return WiggleRenderer.devicePromise
    }
    WiggleRenderer.devicePromise = (async () => {
      try {
        const adapter = await navigator.gpu?.requestAdapter()
        if (!adapter) {
          return null
        }
        const device = await adapter.requestDevice()
        WiggleRenderer.device = device
        WiggleRenderer.initPipelines(device)
        return device
      } catch {
        return null
      }
    })()
    return WiggleRenderer.devicePromise
  }

  private static initPipelines(device: GPUDevice) {
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
    const target: GPUColorTargetState = {
      format: 'bgra8unorm',
      blend: blendState,
    }

    WiggleRenderer.bindGroupLayout = device.createBindGroupLayout({
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
      bindGroupLayouts: [WiggleRenderer.bindGroupLayout],
    })
    const shaderModule = device.createShaderModule({ code: wiggleShader })

    WiggleRenderer.fillPipeline = device.createRenderPipeline({
      layout,
      vertex: { module: shaderModule, entryPoint: 'vs_main' },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [target],
      },
      primitive: { topology: 'triangle-list' },
    })
    WiggleRenderer.linePipeline = device.createRenderPipeline({
      layout,
      vertex: { module: shaderModule, entryPoint: 'vs_main' },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [target],
      },
      primitive: { topology: 'line-list' },
    })
  }

  async init() {
    const device = await WiggleRenderer.ensureDevice()
    if (!device) {
      try {
        this.glFallback = new WebGLWiggleRenderer(this.canvas)
        return true
      } catch {
        return false
      }
    }

    this.context = this.canvas.getContext('webgpu')!
    this.context.configure({
      device,
      format: 'bgra8unorm',
      alphaMode: 'premultiplied',
    })

    this.uniformBuffer = device.createBuffer({
      size: UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    return true
  }

  uploadRegion(
    regionNumber: number,
    data: {
      regionStart: number
      featurePositions: Uint32Array
      featureScores: Float32Array
      numFeatures: number
    },
  ) {
    if (this.glFallback) {
      this.glFallback.uploadForRegion(regionNumber, data)
      return
    }

    const device = WiggleRenderer.device
    if (!device || !WiggleRenderer.bindGroupLayout || !this.uniformBuffer) {
      return
    }

    const old = this.regions.get(regionNumber)
    if (old) {
      old.instanceBuffer.destroy()
    }

    if (data.numFeatures === 0) {
      this.regions.delete(regionNumber)
      return
    }

    const interleaved = this.interleaveInstances(
      data.featurePositions,
      data.featureScores,
      data.numFeatures,
    )
    const instanceBuffer = device.createBuffer({
      size: interleaved.byteLength || 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
    device.queue.writeBuffer(instanceBuffer, 0, interleaved)
    const bindGroup = device.createBindGroup({
      layout: WiggleRenderer.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: instanceBuffer } },
        { binding: 1, resource: { buffer: this.uniformBuffer } },
      ],
    })
    this.regions.set(regionNumber, {
      regionStart: data.regionStart,
      featureCount: data.numFeatures,
      instanceBuffer,
      bindGroup,
    })
  }

  pruneRegions(activeRegions: number[]) {
    if (this.glFallback) {
      this.glFallback.pruneStaleRegions(new Set(activeRegions))
      return
    }

    const active = new Set<number>(activeRegions)
    for (const [num, region] of this.regions) {
      if (!active.has(num)) {
        region.instanceBuffer.destroy()
        this.regions.delete(num)
      }
    }
  }

  renderBlocks(blocks: WiggleRenderBlock[], renderState: WiggleGPURenderState) {
    if (this.glFallback) {
      this.glFallback.renderBlocks(blocks, {
        domainY: renderState.domainY,
        scaleType: renderState.scaleType === 1 ? 'log' : 'linear',
        renderingType: RENDERING_TYPE_MAP[renderState.renderingType] ?? 'xyplot',
        useBicolor: renderState.useBicolor === 1,
        bicolorPivot: renderState.bicolorPivot,
        color: renderState.color,
        posColor: renderState.posColor,
        negColor: renderState.negColor,
        canvasWidth: renderState.canvasWidth,
        canvasHeight: renderState.canvasHeight,
      })
      return
    }

    const device = WiggleRenderer.device
    if (!device || !WiggleRenderer.fillPipeline || !this.context) {
      return
    }

    const { canvasWidth, canvasHeight } = renderState
    const isLine = renderState.renderingType === 2
    const pipeline = isLine
      ? WiggleRenderer.linePipeline!
      : WiggleRenderer.fillPipeline

    if (this.canvas.width !== canvasWidth || this.canvas.height !== canvasHeight) {
      this.canvas.width = canvasWidth
      this.canvas.height = canvasHeight
    }

    const textureView = this.context.getCurrentTexture().createView()
    let isFirst = true

    for (const block of blocks) {
      const region = this.regions.get(block.regionNumber)
      if (!region || region.featureCount === 0) {
        continue
      }

      const scissorX = Math.max(0, Math.floor(block.screenStartPx))
      const scissorEnd = Math.min(canvasWidth, Math.ceil(block.screenEndPx))
      const scissorW = scissorEnd - scissorX
      if (scissorW <= 0) {
        continue
      }

      const fullBlockWidth = block.screenEndPx - block.screenStartPx
      const regionLengthBp = block.bpRangeX[1] - block.bpRangeX[0]
      const bpPerPx = regionLengthBp / fullBlockWidth
      const clippedBpStart =
        block.bpRangeX[0] + (scissorX - block.screenStartPx) * bpPerPx
      const clippedBpEnd =
        block.bpRangeX[0] + (scissorEnd - block.screenStartPx) * bpPerPx
      const [bpStartHi, bpStartLo] = this.splitPositionWithFrac(clippedBpStart)
      const clippedLengthBp = clippedBpEnd - clippedBpStart

      this.writeUniforms(
        device,
        bpStartHi,
        bpStartLo,
        clippedLengthBp,
        Math.floor(region.regionStart),
        renderState,
      )

      const encoder = device.createCommandEncoder()
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: textureView,
            loadOp: (isFirst ? 'clear' : 'load') as GPULoadOp,
            storeOp: 'store' as GPUStoreOp,
            ...(isFirst && { clearValue: { r: 0, g: 0, b: 0, a: 0 } }),
          },
        ],
      })
      pass.setPipeline(pipeline)
      pass.setBindGroup(0, region.bindGroup)
      pass.setViewport(scissorX, 0, scissorW, canvasHeight, 0, 1)
      pass.setScissorRect(scissorX, 0, scissorW, canvasHeight)
      pass.draw(6, region.featureCount)
      pass.end()
      device.queue.submit([encoder.finish()])
      isFirst = false
    }

    if (isFirst) {
      this.clearCanvas(device, textureView)
    }
  }

  renderSingle(bpRangeX: [number, number], renderState: WiggleGPURenderState) {
    if (this.glFallback) {
      this.glFallback.render({
        bpRangeX,
        domainY: renderState.domainY,
        scaleType: renderState.scaleType === 1 ? 'log' : 'linear',
        renderingType: RENDERING_TYPE_MAP[renderState.renderingType] ?? 'xyplot',
        useBicolor: renderState.useBicolor === 1,
        bicolorPivot: renderState.bicolorPivot,
        color: renderState.color,
        posColor: renderState.posColor,
        negColor: renderState.negColor,
        canvasWidth: renderState.canvasWidth,
        canvasHeight: renderState.canvasHeight,
      })
      return
    }

    const device = WiggleRenderer.device
    if (!device || !WiggleRenderer.fillPipeline || !this.context) {
      return
    }

    const { canvasWidth, canvasHeight } = renderState
    const isLine = renderState.renderingType === 2
    const pipeline = isLine
      ? WiggleRenderer.linePipeline!
      : WiggleRenderer.fillPipeline

    if (this.canvas.width !== canvasWidth || this.canvas.height !== canvasHeight) {
      this.canvas.width = canvasWidth
      this.canvas.height = canvasHeight
    }

    const region =
      this.regions.get(0) ?? this.regions.values().next().value
    if (!region || region.featureCount === 0) {
      this.clearCanvas(
        device,
        this.context.getCurrentTexture().createView(),
      )
      return
    }

    const [bpStartHi, bpStartLo] = this.splitPositionWithFrac(bpRangeX[0])
    const regionLengthBp = bpRangeX[1] - bpRangeX[0]

    this.writeUniforms(
      device,
      bpStartHi,
      bpStartLo,
      regionLengthBp,
      Math.floor(region.regionStart),
      renderState,
    )

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
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, region.bindGroup)
    pass.setViewport(0, 0, canvasWidth, canvasHeight, 0, 1)
    pass.draw(6, region.featureCount)
    pass.end()
    device.queue.submit([encoder.finish()])
  }

  dispose() {
    if (this.glFallback) {
      this.glFallback.destroy()
      this.glFallback = null
      return
    }
    for (const region of this.regions.values()) {
      region.instanceBuffer.destroy()
    }
    this.regions.clear()
    this.uniformBuffer?.destroy()
    this.uniformBuffer = null
    this.context = null
  }

  private clearCanvas(device: GPUDevice, textureView: GPUTextureView) {
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

  private writeUniforms(
    device: GPUDevice,
    bpRangeHi: number,
    bpRangeLo: number,
    bpRangeLength: number,
    regionStart: number,
    state: WiggleGPURenderState,
  ) {
    this.uniformF32[0] = bpRangeHi
    this.uniformF32[1] = bpRangeLo
    this.uniformF32[2] = bpRangeLength
    this.uniformU32[3] = regionStart
    this.uniformF32[4] = state.canvasHeight
    this.uniformI32[5] = state.scaleType
    this.uniformI32[6] = state.renderingType
    this.uniformI32[7] = state.useBicolor
    this.uniformF32[8] = state.domainY[0]
    this.uniformF32[9] = state.domainY[1]
    this.uniformF32[10] = state.bicolorPivot
    this.uniformF32[11] = 0
    this.uniformF32[12] = state.color[0]
    this.uniformF32[13] = state.color[1]
    this.uniformF32[14] = state.color[2]
    this.uniformF32[15] = 0
    this.uniformF32[16] = state.posColor[0]
    this.uniformF32[17] = state.posColor[1]
    this.uniformF32[18] = state.posColor[2]
    this.uniformF32[19] = 0
    this.uniformF32[20] = state.negColor[0]
    this.uniformF32[21] = state.negColor[1]
    this.uniformF32[22] = state.negColor[2]
    this.uniformF32[23] = 0
    device.queue.writeBuffer(this.uniformBuffer!, 0, this.uniformData)
  }

  private splitPositionWithFrac(value: number): [number, number] {
    const intValue = Math.floor(value)
    const frac = value - intValue
    const loInt = intValue & 0xfff
    const hi = intValue - loInt
    const lo = loInt + frac
    return [hi, lo]
  }

  private interleaveInstances(
    positions: Uint32Array,
    scores: Float32Array,
    count: number,
  ) {
    const buf = new ArrayBuffer(count * INSTANCE_BYTES)
    const u32 = new Uint32Array(buf)
    const f32 = new Float32Array(buf)
    for (let i = 0; i < count; i++) {
      const off = i * INSTANCE_STRIDE
      u32[off] = positions[i * 2]!
      u32[off + 1] = positions[i * 2 + 1]!
      f32[off + 2] = scores[i]!
      f32[off + 3] = 0
    }
    return buf
  }
}
