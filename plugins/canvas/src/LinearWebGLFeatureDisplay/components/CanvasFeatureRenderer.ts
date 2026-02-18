/// <reference types="@webgpu/types" />

import getGpuDevice from '@jbrowse/core/gpu/getGpuDevice'

import {
  ARROW_SHADER,
  CHEVRON_SHADER,
  LINE_SHADER,
  RECT_SHADER,
} from './canvasShaders.ts'
import { WebGLFeatureRenderer } from './WebGLFeatureRenderer.ts'

const MAX_VISIBLE_CHEVRONS_PER_LINE = 128

const UNIFORM_SIZE = 32
const RECT_STRIDE = 8
const LINE_STRIDE = 8
const CHEVRON_STRIDE = 8
const ARROW_STRIDE = 8

interface GpuRegionData {
  regionStart: number
  rectBuffer: GPUBuffer | null
  rectCount: number
  rectBindGroup: GPUBindGroup | null
  lineBuffer: GPUBuffer | null
  lineCount: number
  lineBindGroup: GPUBindGroup | null
  chevronBuffer: GPUBuffer | null
  chevronBindGroup: GPUBindGroup | null
  arrowBuffer: GPUBuffer | null
  arrowCount: number
  arrowBindGroup: GPUBindGroup | null
}

export interface FeatureRenderBlock {
  regionNumber: number
  bpRangeX: [number, number]
  screenStartPx: number
  screenEndPx: number
}

const rendererCache = new WeakMap<HTMLCanvasElement, CanvasFeatureRenderer>()

export class CanvasFeatureRenderer {
  private static device: GPUDevice | null = null
  private static rectPipeline: GPURenderPipeline | null = null
  private static linePipeline: GPURenderPipeline | null = null
  private static chevronPipeline: GPURenderPipeline | null = null
  private static arrowPipeline: GPURenderPipeline | null = null
  private static bindGroupLayout: GPUBindGroupLayout | null = null

  private canvas: HTMLCanvasElement
  private context: GPUCanvasContext | null = null
  private uniformBuffer: GPUBuffer | null = null
  private msaaTexture: GPUTexture | null = null
  private msaaWidth = 0
  private msaaHeight = 0
  private uniformData = new ArrayBuffer(UNIFORM_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)
  private uniformU32 = new Uint32Array(this.uniformData)
  private regions = new Map<number, GpuRegionData>()
  private glFallback: WebGLFeatureRenderer | null = null

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static getOrCreate(canvas: HTMLCanvasElement) {
    let renderer = rendererCache.get(canvas)
    if (!renderer) {
      renderer = new CanvasFeatureRenderer(canvas)
      rendererCache.set(canvas, renderer)
    }
    return renderer
  }

  private static async ensureDevice() {
    if (CanvasFeatureRenderer.device) {
      return CanvasFeatureRenderer.device
    }
    const device = await getGpuDevice()
    if (device && !CanvasFeatureRenderer.device) {
      CanvasFeatureRenderer.device = device
      CanvasFeatureRenderer.initPipelines(device)
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

    CanvasFeatureRenderer.bindGroupLayout = device.createBindGroupLayout({
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
      bindGroupLayouts: [CanvasFeatureRenderer.bindGroupLayout],
    })

    const multisample: GPUMultisampleState = { count: 4 }

    const rectModule = device.createShaderModule({ code: RECT_SHADER })
    CanvasFeatureRenderer.rectPipeline = device.createRenderPipeline({
      layout,
      vertex: { module: rectModule, entryPoint: 'vs_main' },
      fragment: {
        module: rectModule,
        entryPoint: 'fs_main',
        targets: [target],
      },
      primitive: { topology: 'triangle-list' },
      multisample,
    })

    const lineModule = device.createShaderModule({ code: LINE_SHADER })
    CanvasFeatureRenderer.linePipeline = device.createRenderPipeline({
      layout,
      vertex: { module: lineModule, entryPoint: 'vs_main' },
      fragment: {
        module: lineModule,
        entryPoint: 'fs_main',
        targets: [target],
      },
      primitive: { topology: 'triangle-list' },
      multisample,
    })

    const chevronModule = device.createShaderModule({ code: CHEVRON_SHADER })
    CanvasFeatureRenderer.chevronPipeline = device.createRenderPipeline({
      layout,
      vertex: { module: chevronModule, entryPoint: 'vs_main' },
      fragment: {
        module: chevronModule,
        entryPoint: 'fs_main',
        targets: [target],
      },
      primitive: { topology: 'triangle-list' },
      multisample,
    })

    const arrowModule = device.createShaderModule({ code: ARROW_SHADER })
    CanvasFeatureRenderer.arrowPipeline = device.createRenderPipeline({
      layout,
      vertex: { module: arrowModule, entryPoint: 'vs_main' },
      fragment: {
        module: arrowModule,
        entryPoint: 'fs_main',
        targets: [target],
      },
      primitive: { topology: 'triangle-list' },
      multisample,
    })
  }

  async init() {
    const device = await CanvasFeatureRenderer.ensureDevice()
    if (!device) {
      try {
        this.glFallback = new WebGLFeatureRenderer(this.canvas)
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
      rectPositions: Uint32Array
      rectYs: Float32Array
      rectHeights: Float32Array
      rectColors: Uint8Array
      numRects: number
      linePositions: Uint32Array
      lineYs: Float32Array
      lineColors: Uint8Array
      lineDirections: Int8Array
      numLines: number
      arrowXs: Uint32Array
      arrowYs: Float32Array
      arrowDirections: Int8Array
      arrowHeights: Float32Array
      arrowColors: Uint8Array
      numArrows: number
    },
  ) {
    if (this.glFallback) {
      this.glFallback.uploadForRegion(regionNumber, data)
      return
    }
    const device = CanvasFeatureRenderer.device
    if (!device || !CanvasFeatureRenderer.bindGroupLayout || !this.uniformBuffer) {
      return
    }

    const old = this.regions.get(regionNumber)
    if (old) {
      this.destroyRegion(old)
    }

    const region: GpuRegionData = {
      regionStart: data.regionStart,
      rectBuffer: null,
      rectCount: data.numRects,
      rectBindGroup: null,
      lineBuffer: null,
      lineCount: data.numLines,
      lineBindGroup: null,
      chevronBuffer: null,
      chevronBindGroup: null,
      arrowBuffer: null,
      arrowCount: data.numArrows,
      arrowBindGroup: null,
    }

    if (data.numRects > 0) {
      const interleaved = this.interleaveRects(
        data.rectPositions,
        data.rectYs,
        data.rectHeights,
        data.rectColors,
        data.numRects,
      )
      region.rectBuffer = this.createStorageBuffer(device, interleaved)
      region.rectBindGroup = this.createBindGroup(device, region.rectBuffer)
    }

    if (data.numLines > 0) {
      const lineInterleaved = this.interleaveLines(
        data.linePositions,
        data.lineYs,
        data.lineColors,
        data.numLines,
      )
      region.lineBuffer = this.createStorageBuffer(device, lineInterleaved)
      region.lineBindGroup = this.createBindGroup(device, region.lineBuffer)
      const chevronInterleaved = this.interleaveChevrons(
        data.linePositions,
        data.lineYs,
        data.lineDirections,
        data.lineColors,
        data.numLines,
      )
      region.chevronBuffer = this.createStorageBuffer(device, chevronInterleaved)
      region.chevronBindGroup = this.createBindGroup(device, region.chevronBuffer)
    }

    if (data.numArrows > 0) {
      const arrowInterleaved = this.interleaveArrows(
        data.arrowXs,
        data.arrowYs,
        data.arrowDirections,
        data.arrowHeights,
        data.arrowColors,
        data.numArrows,
      )
      region.arrowBuffer = this.createStorageBuffer(device, arrowInterleaved)
      region.arrowBindGroup = this.createBindGroup(device, region.arrowBuffer)
    }

    this.regions.set(regionNumber, region)
  }

  renderBlocks(
    blocks: FeatureRenderBlock[],
    state: { scrollY: number; canvasWidth: number; canvasHeight: number },
  ) {
    if (this.glFallback) {
      this.glFallback.renderBlocks(blocks, state)
      return
    }
    const device = CanvasFeatureRenderer.device
    if (!device || !CanvasFeatureRenderer.rectPipeline || !this.context) {
      return
    }

    const { canvasWidth, canvasHeight, scrollY } = state

    if (this.canvas.width !== canvasWidth || this.canvas.height !== canvasHeight) {
      this.canvas.width = canvasWidth
      this.canvas.height = canvasHeight
    }

    if (
      !this.msaaTexture ||
      this.msaaWidth !== canvasWidth ||
      this.msaaHeight !== canvasHeight
    ) {
      this.msaaTexture?.destroy()
      this.msaaTexture = device.createTexture({
        size: [canvasWidth, canvasHeight],
        format: 'bgra8unorm',
        sampleCount: 4,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      })
      this.msaaWidth = canvasWidth
      this.msaaHeight = canvasHeight
    }

    const msaaView = this.msaaTexture.createView()
    const resolveTarget = this.context.getCurrentTexture().createView()
    let isFirst = true

    for (const block of blocks) {
      const region = this.regions.get(block.regionNumber)
      if (!region) {
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
        canvasHeight,
        scissorW,
        scrollY,
        bpPerPx,
      )

      const encoder = device.createCommandEncoder()
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: msaaView,
            resolveTarget,
            loadOp: (isFirst ? 'clear' : 'load') as GPULoadOp,
            storeOp: 'store' as GPUStoreOp,
            ...(isFirst && { clearValue: { r: 0, g: 0, b: 0, a: 0 } }),
          },
        ],
      })

      pass.setViewport(scissorX, 0, scissorW, canvasHeight, 0, 1)
      pass.setScissorRect(scissorX, 0, scissorW, canvasHeight)

      if (region.lineBindGroup && region.lineCount > 0) {
        pass.setPipeline(CanvasFeatureRenderer.linePipeline!)
        pass.setBindGroup(0, region.lineBindGroup)
        pass.draw(6, region.lineCount)
      }

      if (region.chevronBindGroup && region.lineCount > 0) {
        pass.setPipeline(CanvasFeatureRenderer.chevronPipeline!)
        pass.setBindGroup(0, region.chevronBindGroup)
        pass.draw(MAX_VISIBLE_CHEVRONS_PER_LINE * 12, region.lineCount)
      }

      if (region.rectBindGroup && region.rectCount > 0) {
        pass.setPipeline(CanvasFeatureRenderer.rectPipeline!)
        pass.setBindGroup(0, region.rectBindGroup)
        pass.draw(6, region.rectCount)
      }

      if (region.arrowBindGroup && region.arrowCount > 0) {
        pass.setPipeline(CanvasFeatureRenderer.arrowPipeline!)
        pass.setBindGroup(0, region.arrowBindGroup)
        pass.draw(9, region.arrowCount)
      }

      pass.end()
      device.queue.submit([encoder.finish()])
      isFirst = false
    }

    if (isFirst) {
      const encoder = device.createCommandEncoder()
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: resolveTarget,
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

  pruneStaleRegions(activeRegions: number[]) {
    if (this.glFallback) {
      this.glFallback.pruneStaleRegions(new Set(activeRegions))
      return
    }
    const active = new Set<number>(activeRegions)
    for (const [num, region] of this.regions) {
      if (!active.has(num)) {
        this.destroyRegion(region)
        this.regions.delete(num)
      }
    }
  }

  dispose() {
    if (this.glFallback) {
      this.glFallback.destroy()
      this.glFallback = null
      return
    }
    for (const region of this.regions.values()) {
      this.destroyRegion(region)
    }
    this.regions.clear()
    this.uniformBuffer?.destroy()
    this.uniformBuffer = null
    this.msaaTexture?.destroy()
    this.msaaTexture = null
    this.context = null
  }

  private destroyRegion(region: GpuRegionData) {
    region.rectBuffer?.destroy()
    region.lineBuffer?.destroy()
    region.chevronBuffer?.destroy()
    region.arrowBuffer?.destroy()
  }

  private createStorageBuffer(device: GPUDevice, data: ArrayBuffer) {
    const buf = device.createBuffer({
      size: Math.max(data.byteLength, 4),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
    device.queue.writeBuffer(buf, 0, data)
    return buf
  }

  private createBindGroup(device: GPUDevice, storageBuffer: GPUBuffer) {
    return device.createBindGroup({
      layout: CanvasFeatureRenderer.bindGroupLayout!,
      entries: [
        { binding: 0, resource: { buffer: storageBuffer } },
        { binding: 1, resource: { buffer: this.uniformBuffer! } },
      ],
    })
  }

  private writeUniforms(
    device: GPUDevice,
    bpRangeHi: number,
    bpRangeLo: number,
    bpRangeLength: number,
    regionStart: number,
    canvasHeight: number,
    canvasWidth: number,
    scrollY: number,
    bpPerPx: number,
  ) {
    this.uniformF32[0] = bpRangeHi
    this.uniformF32[1] = bpRangeLo
    this.uniformF32[2] = bpRangeLength
    this.uniformU32[3] = regionStart
    this.uniformF32[4] = canvasHeight
    this.uniformF32[5] = canvasWidth
    this.uniformF32[6] = scrollY
    this.uniformF32[7] = bpPerPx
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

  private interleaveRects(
    positions: Uint32Array,
    ys: Float32Array,
    heights: Float32Array,
    colors: Uint8Array,
    count: number,
  ) {
    const buf = new ArrayBuffer(count * RECT_STRIDE * 4)
    const u32 = new Uint32Array(buf)
    const f32 = new Float32Array(buf)
    for (let i = 0; i < count; i++) {
      const off = i * RECT_STRIDE
      u32[off] = positions[i * 2]!
      u32[off + 1] = positions[i * 2 + 1]!
      f32[off + 2] = ys[i]!
      f32[off + 3] = heights[i]!
      f32[off + 4] = colors[i * 4]! / 255
      f32[off + 5] = colors[i * 4 + 1]! / 255
      f32[off + 6] = colors[i * 4 + 2]! / 255
      f32[off + 7] = colors[i * 4 + 3]! / 255
    }
    return buf
  }

  private interleaveLines(
    positions: Uint32Array,
    ys: Float32Array,
    colors: Uint8Array,
    count: number,
  ) {
    const buf = new ArrayBuffer(count * LINE_STRIDE * 4)
    const u32 = new Uint32Array(buf)
    const f32 = new Float32Array(buf)
    for (let i = 0; i < count; i++) {
      const off = i * LINE_STRIDE
      u32[off] = positions[i * 2]!
      u32[off + 1] = positions[i * 2 + 1]!
      f32[off + 2] = ys[i]!
      f32[off + 3] = 0
      f32[off + 4] = colors[i * 4]! / 255
      f32[off + 5] = colors[i * 4 + 1]! / 255
      f32[off + 6] = colors[i * 4 + 2]! / 255
      f32[off + 7] = colors[i * 4 + 3]! / 255
    }
    return buf
  }

  private interleaveChevrons(
    positions: Uint32Array,
    ys: Float32Array,
    directions: Int8Array,
    colors: Uint8Array,
    count: number,
  ) {
    const buf = new ArrayBuffer(count * CHEVRON_STRIDE * 4)
    const u32 = new Uint32Array(buf)
    const f32 = new Float32Array(buf)
    for (let i = 0; i < count; i++) {
      const off = i * CHEVRON_STRIDE
      u32[off] = positions[i * 2]!
      u32[off + 1] = positions[i * 2 + 1]!
      f32[off + 2] = ys[i]!
      f32[off + 3] = directions[i]!
      f32[off + 4] = colors[i * 4]! / 255
      f32[off + 5] = colors[i * 4 + 1]! / 255
      f32[off + 6] = colors[i * 4 + 2]! / 255
      f32[off + 7] = colors[i * 4 + 3]! / 255
    }
    return buf
  }

  private interleaveArrows(
    xs: Uint32Array,
    ys: Float32Array,
    directions: Int8Array,
    heights: Float32Array,
    colors: Uint8Array,
    count: number,
  ) {
    const buf = new ArrayBuffer(count * ARROW_STRIDE * 4)
    const u32 = new Uint32Array(buf)
    const f32 = new Float32Array(buf)
    for (let i = 0; i < count; i++) {
      const off = i * ARROW_STRIDE
      u32[off] = xs[i]!
      u32[off + 1] = 0
      f32[off + 2] = ys[i]!
      f32[off + 3] = directions[i]!
      f32[off + 4] = heights[i]!
      f32[off + 5] = colors[i * 4]! / 255
      f32[off + 6] = colors[i * 4 + 1]! / 255
      f32[off + 7] = colors[i * 4 + 2]! / 255
    }
    return buf
  }
}
