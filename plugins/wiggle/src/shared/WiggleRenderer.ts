/// <reference types="@webgpu/types" />

import getGpuDevice from '@jbrowse/core/gpu/getGpuDevice'
import { initGpuContext } from '@jbrowse/core/gpu/initGpuContext'

import { WebGLWiggleRenderer } from './WebGLWiggleRenderer.ts'
import { computeNumRows, interleaveInstances, splitPositionWithFrac } from './webglUtils.ts'
import {
  RENDERING_TYPE_LINE,
  UNIFORM_SIZE,
  VERTICES_PER_INSTANCE,
  wiggleShader,
} from './wiggleShader.ts'

interface GpuRegionData {
  regionStart: number
  featureCount: number
  numRows: number
  instanceBuffer: GPUBuffer
  bindGroup: GPUBindGroup
}

export interface WiggleGPURenderState {
  domainY: [number, number]
  scaleType: number
  renderingType: number
  rowPadding: number
  canvasWidth: number
  canvasHeight: number
}

export interface WiggleRenderBlock {
  regionNumber: number
  bpRangeX: [number, number]
  screenStartPx: number
  screenEndPx: number
}

export interface SourceRenderData {
  featurePositions: Uint32Array
  featureScores: Float32Array
  numFeatures: number
  color: [number, number, number]
  rowIndex?: number
}

const rendererCache = new WeakMap<HTMLCanvasElement, WiggleRenderer>()

export class WiggleRenderer {
  private static device: GPUDevice | null = null
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
    const device = await getGpuDevice()
    if (!device) {
      return null
    }
    if (WiggleRenderer.device !== device) {
      WiggleRenderer.device = device
      WiggleRenderer.initPipelines(device)
    }
    return device
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
    if (device) {
      const result = await initGpuContext(this.canvas)
      if (result) {
        this.context = result.context
        this.uniformBuffer = device.createBuffer({
          size: UNIFORM_SIZE,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })
        return true
      }
    }
    try {
      this.glFallback = new WebGLWiggleRenderer(this.canvas)
      return true
    } catch (e) {
      console.error('[WiggleRenderer] WebGL2 fallback also failed:', e)
      return false
    }
  }

  uploadRegion(
    regionNumber: number,
    regionStart: number,
    sources: SourceRenderData[],
  ) {
    if (this.glFallback) {
      this.glFallback.uploadRegion(regionNumber, regionStart, sources)
      return
    }

    const device = WiggleRenderer.device
    if (
      !device ||
      !WiggleRenderer.bindGroupLayout ||
      !this.uniformBuffer
    ) {
      return
    }

    const old = this.regions.get(regionNumber)
    if (old) {
      old.instanceBuffer.destroy()
    }

    let totalFeatures = 0
    for (const source of sources) {
      totalFeatures += source.numFeatures
    }

    if (totalFeatures === 0 || sources.length === 0) {
      this.regions.delete(regionNumber)
      return
    }

    const interleaved = interleaveInstances(sources, totalFeatures)
    const numRows = computeNumRows(sources)
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
      regionStart,
      featureCount: totalFeatures,
      numRows,
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

  renderBlocks(
    blocks: WiggleRenderBlock[],
    renderState: WiggleGPURenderState,
  ) {
    if (this.glFallback) {
      this.glFallback.renderBlocks(blocks, renderState)
      return
    }

    const device = WiggleRenderer.device
    if (!device || !WiggleRenderer.fillPipeline || !this.context) {
      return
    }

    const { canvasWidth, canvasHeight } = renderState
    const dpr = window.devicePixelRatio || 1
    const bufW = Math.round(canvasWidth * dpr)
    const bufH = Math.round(canvasHeight * dpr)
    const isLine = renderState.renderingType === RENDERING_TYPE_LINE
    const pipeline = isLine
      ? WiggleRenderer.linePipeline!
      : WiggleRenderer.fillPipeline

    if (this.canvas.width !== bufW || this.canvas.height !== bufH) {
      this.canvas.width = bufW
      this.canvas.height = bufH
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
      const [bpStartHi, bpStartLo] = splitPositionWithFrac(clippedBpStart)
      const clippedLengthBp = clippedBpEnd - clippedBpStart

      this.writeUniforms(
        device,
        bpStartHi,
        bpStartLo,
        clippedLengthBp,
        Math.floor(region.regionStart),
        region.numRows,
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
      pass.setViewport(
        Math.round(scissorX * dpr),
        0,
        Math.round(scissorW * dpr),
        bufH,
        0,
        1,
      )
      pass.setScissorRect(
        Math.round(scissorX * dpr),
        0,
        Math.round(scissorW * dpr),
        bufH,
      )
      pass.draw(VERTICES_PER_INSTANCE, region.featureCount)
      pass.end()
      device.queue.submit([encoder.finish()])
      isFirst = false
    }

    if (isFirst) {
      this.clearCanvas(device, textureView)
    }
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
    numRows: number,
    state: WiggleGPURenderState,
  ) {
    this.uniformF32[0] = bpRangeHi
    this.uniformF32[1] = bpRangeLo
    this.uniformF32[2] = bpRangeLength
    this.uniformU32[3] = regionStart
    this.uniformF32[4] = state.canvasHeight
    this.uniformI32[5] = state.scaleType
    this.uniformI32[6] = state.renderingType
    this.uniformF32[7] = numRows
    this.uniformF32[8] = state.domainY[0]
    this.uniformF32[9] = state.domainY[1]
    this.uniformF32[10] = state.rowPadding
    this.uniformF32[11] = 0
    device.queue.writeBuffer(this.uniformBuffer!, 0, this.uniformData)
  }

}
