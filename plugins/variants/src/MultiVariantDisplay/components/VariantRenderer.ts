/// <reference types="@webgpu/types" />

import getGpuDevice, { getGpuOverride } from '@jbrowse/core/gpu/getGpuDevice'
import { initGpuContext } from '@jbrowse/core/gpu/initGpuContext'

import { Canvas2DVariantRenderer } from './Canvas2DVariantRenderer.ts'
import { WebGLVariantRenderer } from './WebGLVariantRenderer.ts'
import { interleaveVariantInstances, variantShader } from './variantShaders.ts'
import { splitPositionWithFrac } from '../../shared/variantWebglUtils.ts'

import type { VariantRenderBlock } from './WebGLVariantRenderer.ts'

const UNIFORM_SIZE = 48

interface RegionGpuData {
  instanceBuffer: GPUBuffer
  bindGroup: GPUBindGroup
  cellCount: number
  regionStart: number
}

const rendererCache = new WeakMap<HTMLCanvasElement, VariantRenderer>()

export class VariantRenderer {
  private static device: GPUDevice | null = null
  private static pipeline: GPURenderPipeline | null = null
  private static bindGroupLayout: GPUBindGroupLayout | null = null

  private canvas: HTMLCanvasElement
  private context: GPUCanvasContext | null = null
  private uniformBuffer: GPUBuffer | null = null
  private uniformData = new ArrayBuffer(UNIFORM_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)
  private uniformU32 = new Uint32Array(this.uniformData)
  private regionDataMap = new Map<number, RegionGpuData>()
  private glFallback: WebGLVariantRenderer | null = null
  private canvas2dFallback: Canvas2DVariantRenderer | null = null

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static getOrCreate(canvas: HTMLCanvasElement) {
    let renderer = rendererCache.get(canvas)
    if (!renderer) {
      renderer = new VariantRenderer(canvas)
      rendererCache.set(canvas, renderer)
    }
    return renderer
  }

  private static async ensureDevice() {
    const device = await getGpuDevice()
    if (!device) {
      return null
    }
    if (VariantRenderer.device !== device) {
      VariantRenderer.device = device
      VariantRenderer.initPipelines(device)
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

    VariantRenderer.bindGroupLayout = device.createBindGroupLayout({
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
      bindGroupLayouts: [VariantRenderer.bindGroupLayout],
    })
    const shaderModule = device.createShaderModule({ code: variantShader })

    VariantRenderer.pipeline = device.createRenderPipeline({
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
    if (getGpuOverride() === 'canvas2d') {
      this.canvas2dFallback = new Canvas2DVariantRenderer(this.canvas)
      return true
    }

    const device = await VariantRenderer.ensureDevice()
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
      this.glFallback = new WebGLVariantRenderer(this.canvas)
      return true
    } catch (e) {
      console.error('[VariantRenderer] WebGL2 fallback failed:', e)
      try {
        this.canvas2dFallback = new Canvas2DVariantRenderer(this.canvas)
        return true
      } catch (e2) {
        console.error('[VariantRenderer] Canvas 2D fallback also failed:', e2)
        return false
      }
    }
  }

  uploadRegion(
    regionNumber: number,
    data: {
      regionStart: number
      cellPositions: Uint32Array
      cellRowIndices: Uint32Array
      cellColors: Uint8Array
      cellShapeTypes: Uint8Array
      numCells: number
    },
  ) {
    if (this.glFallback) {
      this.glFallback.uploadRegion(regionNumber, data)
      return
    }
    if (this.canvas2dFallback) {
      this.canvas2dFallback.uploadRegion(regionNumber, data)
      return
    }

    const device = VariantRenderer.device
    if (!device || !VariantRenderer.bindGroupLayout || !this.uniformBuffer) {
      return
    }

    const existing = this.regionDataMap.get(regionNumber)
    if (existing) {
      existing.instanceBuffer.destroy()
    }

    if (data.numCells === 0) {
      this.regionDataMap.delete(regionNumber)
      return
    }

    const interleaved = interleaveVariantInstances(data)
    const instanceBuffer = device.createBuffer({
      size: interleaved.byteLength || 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
    device.queue.writeBuffer(instanceBuffer, 0, interleaved)

    const bindGroup = device.createBindGroup({
      layout: VariantRenderer.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: instanceBuffer } },
        { binding: 1, resource: { buffer: this.uniformBuffer } },
      ],
    })

    this.regionDataMap.set(regionNumber, {
      instanceBuffer,
      bindGroup,
      cellCount: data.numCells,
      regionStart: data.regionStart,
    })
  }

  pruneStaleRegions(activeRegionNumbers: number[]) {
    if (this.glFallback) {
      this.glFallback.pruneStaleRegions(activeRegionNumbers)
      return
    }
    if (this.canvas2dFallback) {
      this.canvas2dFallback.pruneStaleRegions(activeRegionNumbers)
      return
    }
    const active = new Set(activeRegionNumbers)
    for (const [regionNumber, data] of this.regionDataMap) {
      if (!active.has(regionNumber)) {
        data.instanceBuffer.destroy()
        this.regionDataMap.delete(regionNumber)
      }
    }
  }

  renderBlocks(
    blocks: VariantRenderBlock[],
    state: {
      canvasWidth: number
      canvasHeight: number
      rowHeight: number
      scrollTop: number
    },
  ) {
    if (this.glFallback) {
      this.glFallback.renderBlocks(blocks, state)
      return
    }
    if (this.canvas2dFallback) {
      this.canvas2dFallback.renderBlocks(blocks, state)
      return
    }

    const device = VariantRenderer.device
    if (!device || !VariantRenderer.pipeline || !this.context) {
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
    let isFirst = true

    for (const block of blocks) {
      const region = this.regionDataMap.get(block.regionNumber)
      if (!region || region.cellCount === 0) {
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
        scissorW,
        state,
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
      pass.setPipeline(VariantRenderer.pipeline)
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
      pass.draw(6, region.cellCount)
      pass.end()
      device.queue.submit([encoder.finish()])
      isFirst = false
    }

    if (isFirst) {
      this.clearCanvas(device, textureView)
    }
  }

  private writeUniforms(
    device: GPUDevice,
    bpRangeHi: number,
    bpRangeLo: number,
    bpRangeLength: number,
    regionStart: number,
    canvasWidth: number,
    state: { canvasHeight: number; rowHeight: number; scrollTop: number },
  ) {
    this.uniformF32[0] = bpRangeHi
    this.uniformF32[1] = bpRangeLo
    this.uniformF32[2] = bpRangeLength
    this.uniformU32[3] = regionStart
    this.uniformF32[4] = state.canvasHeight
    this.uniformF32[5] = canvasWidth
    this.uniformF32[6] = state.rowHeight
    this.uniformF32[7] = state.scrollTop
    device.queue.writeBuffer(this.uniformBuffer!, 0, this.uniformData)
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
}
