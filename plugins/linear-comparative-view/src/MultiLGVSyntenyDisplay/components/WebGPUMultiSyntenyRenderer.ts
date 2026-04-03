/// <reference types="@webgpu/types" />

import { getDevicePixelRatio, resizeCanvas } from '@jbrowse/alignments-core'
import getGpuDevice from '@jbrowse/core/gpu/getGpuDevice'
import { initGpuContext } from '@jbrowse/core/gpu/initGpuContext'
import {
  STANDARD_BLEND_STATE,
  createStandardBindGroup,
  createStandardBindGroupLayout,
  createStorageBuffer,
} from '@jbrowse/core/gpu/webgpuUtils'

import {
  fillSyntenyUniforms,
  computeDepthScale,
  computeGlobalMaxDepth,
  getRegionForBlock,
  visibleBlocks,
} from './multiSyntenyGpuUtils.ts'
import {
  UNIFORM_BYTE_SIZE,
  WGSL_FILL_SHADER,
  WGSL_COVERAGE_SHADER,
  WGSL_SNP_COVERAGE_SHADER,
} from './multiSyntenyGpuShaders.ts'

import { BG_COLOR_GL } from './multiSyntenyBackendTypes.ts'
import type { MultiSyntenyGpuBackend } from './multiSyntenyBackendTypes.ts'
import type { BlockGeometryData, BlockCoverageUploadData, BlockSnpUploadData } from './multiSyntenyGpuData.ts'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'

interface SyntenyGpuRegion {
  regionStart: number
  instanceBuffer: GPUBuffer | null
  instanceBindGroup: GPUBindGroup | null
  instanceCount: number
  coverageBuffer: GPUBuffer | null
  coverageBindGroup: GPUBindGroup | null
  coverageBinCount: number
  coverageMaxDepth: number
  snpBuffer: GPUBuffer | null
  snpBindGroup: GPUBindGroup | null
  snpSegmentCount: number
}

export class WebGPUMultiSyntenyRenderer implements MultiSyntenyGpuBackend {
  private static device: GPUDevice | null = null
  private static fillPipeline: GPURenderPipeline | null = null
  private static pickingPipeline: GPURenderPipeline | null = null
  private static coveragePipeline: GPURenderPipeline | null = null
  private static snpCoveragePipeline: GPURenderPipeline | null = null
  private static bindGroupLayout: GPUBindGroupLayout | null = null
  private static pipelinesReady: Promise<void> | null = null

  private canvas: HTMLCanvasElement
  private context: GPUCanvasContext
  private uniformBuffer: GPUBuffer

  private uniformData = new ArrayBuffer(UNIFORM_BYTE_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)

  private regions = new Map<string, SyntenyGpuRegion>()

  private constructor(
    canvas: HTMLCanvasElement,
    context: GPUCanvasContext,
    device: GPUDevice,
  ) {
    this.canvas = canvas
    this.context = context
    this.uniformBuffer = device.createBuffer({
      size: UNIFORM_BYTE_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
  }

  static async create(canvas: HTMLCanvasElement) {
    const device = await WebGPUMultiSyntenyRenderer.ensureDevice()
    if (!device) {
      return null
    }
    const result = await initGpuContext(canvas, { alphaMode: 'opaque' })
    if (!result) {
      return null
    }
    return new WebGPUMultiSyntenyRenderer(canvas, result.context, device)
  }

  private static async ensureDevice() {
    const device = await getGpuDevice()
    if (!device) {
      return null
    }
    if (WebGPUMultiSyntenyRenderer.device !== device) {
      WebGPUMultiSyntenyRenderer.device = device
      WebGPUMultiSyntenyRenderer.pipelinesReady =
        WebGPUMultiSyntenyRenderer.initPipelines(device)
    }
    await WebGPUMultiSyntenyRenderer.pipelinesReady
    return device
  }

  private static async initPipelines(device: GPUDevice) {
    WebGPUMultiSyntenyRenderer.bindGroupLayout =
      createStandardBindGroupLayout(device)

    const layout = device.createPipelineLayout({
      bindGroupLayouts: [WebGPUMultiSyntenyRenderer.bindGroupLayout],
    })

    const fillModule = device.createShaderModule({ code: WGSL_FILL_SHADER })
    const coverageModule = device.createShaderModule({ code: WGSL_COVERAGE_SHADER })
    const snpModule = device.createShaderModule({ code: WGSL_SNP_COVERAGE_SHADER })

    ;[
      WebGPUMultiSyntenyRenderer.fillPipeline,
      WebGPUMultiSyntenyRenderer.pickingPipeline,
      WebGPUMultiSyntenyRenderer.coveragePipeline,
      WebGPUMultiSyntenyRenderer.snpCoveragePipeline,
    ] = await Promise.all([
      device.createRenderPipelineAsync({
        layout,
        vertex: { module: fillModule, entryPoint: 'vs_main' },
        fragment: {
          module: fillModule,
          entryPoint: 'fs_main',
          targets: [{ format: 'bgra8unorm', blend: STANDARD_BLEND_STATE }],
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
        vertex: { module: coverageModule, entryPoint: 'vs_main' },
        fragment: {
          module: coverageModule,
          entryPoint: 'fs_main',
          targets: [{ format: 'bgra8unorm', blend: STANDARD_BLEND_STATE }],
        },
        primitive: { topology: 'triangle-list' },
      }),
      device.createRenderPipelineAsync({
        layout,
        vertex: { module: snpModule, entryPoint: 'vs_main' },
        fragment: {
          module: snpModule,
          entryPoint: 'fs_main',
          targets: [{ format: 'bgra8unorm', blend: STANDARD_BLEND_STATE }],
        },
        primitive: { topology: 'triangle-list' },
      }),
    ])
  }

  private getOrCreateRegion(blockKey: string, regionStart: number) {
    let region = this.regions.get(blockKey)
    if (!region) {
      region = {
        regionStart,
        instanceBuffer: null,
        instanceBindGroup: null,
        instanceCount: 0,
        coverageBuffer: null,
        coverageBindGroup: null,
        coverageBinCount: 0,
        coverageMaxDepth: 0,
        snpBuffer: null,
        snpBindGroup: null,
        snpSegmentCount: 0,
      }
      this.regions.set(blockKey, region)
    }
    return region
  }

  resize(width: number, height: number) {
    resizeCanvas(this.canvas, width, height)
  }

  uploadGeometryForBlock(
    blockKey: string,
    data: BlockGeometryData & { regionStart: number },
  ) {
    const device = WebGPUMultiSyntenyRenderer.device
    const bgl = WebGPUMultiSyntenyRenderer.bindGroupLayout
    if (!device || !bgl) {
      return
    }

    const existing = this.regions.get(blockKey)
    if (existing?.instanceBuffer) {
      existing.instanceBuffer.destroy()
    }

    if (data.instanceCount === 0) {
      if (existing) {
        existing.instanceBuffer = null
        existing.instanceBindGroup = null
        existing.instanceCount = 0
      }
      return
    }

    const region = this.getOrCreateRegion(blockKey, data.regionStart)
    region.regionStart = data.regionStart
    region.instanceCount = data.instanceCount
    region.instanceBuffer = createStorageBuffer(device, data.buffer)
    region.instanceBindGroup = createStandardBindGroup(
      device,
      bgl,
      region.instanceBuffer,
      this.uniformBuffer,
    )
  }

  uploadCoverageForBlock(
    blockKey: string,
    data: BlockCoverageUploadData & { regionStart: number; maxDepth: number },
  ) {
    const device = WebGPUMultiSyntenyRenderer.device
    const bgl = WebGPUMultiSyntenyRenderer.bindGroupLayout
    if (!device || !bgl) {
      return
    }

    const existing = this.regions.get(blockKey)
    if (existing?.coverageBuffer) {
      existing.coverageBuffer.destroy()
    }

    if (data.binCount === 0) {
      if (existing) {
        existing.coverageBuffer = null
        existing.coverageBindGroup = null
        existing.coverageBinCount = 0
        existing.coverageMaxDepth = data.maxDepth
      }
      return
    }

    const region = this.getOrCreateRegion(blockKey, data.regionStart)
    region.coverageBinCount = data.binCount
    region.coverageMaxDepth = data.maxDepth
    region.coverageBuffer = createStorageBuffer(device, data.buffer)
    region.coverageBindGroup = createStandardBindGroup(
      device,
      bgl,
      region.coverageBuffer,
      this.uniformBuffer,
    )
  }

  uploadSnpCoverageForBlock(
    blockKey: string,
    data: BlockSnpUploadData,
  ) {
    const device = WebGPUMultiSyntenyRenderer.device
    const bgl = WebGPUMultiSyntenyRenderer.bindGroupLayout
    if (!device || !bgl) {
      return
    }

    const existing = this.regions.get(blockKey)
    if (existing?.snpBuffer) {
      existing.snpBuffer.destroy()
    }

    if (data.segmentCount === 0) {
      if (existing) {
        existing.snpBuffer = null
        existing.snpBindGroup = null
        existing.snpSegmentCount = 0
      }
      return
    }

    const region = this.regions.get(blockKey)
    if (!region) {
      return
    }
    region.snpSegmentCount = data.segmentCount
    region.snpBuffer = createStorageBuffer(device, data.buffer)
    region.snpBindGroup = createStandardBindGroup(
      device,
      bgl,
      region.snpBuffer,
      this.uniformBuffer,
    )
  }

  clearBlock(blockKey: string) {
    const region = this.regions.get(blockKey)
    if (region) {
      region.instanceBuffer?.destroy()
      region.coverageBuffer?.destroy()
      region.snpBuffer?.destroy()
      this.regions.delete(blockKey)
    }
  }

  clearAllBlocks() {
    for (const region of this.regions.values()) {
      region.instanceBuffer?.destroy()
      region.coverageBuffer?.destroy()
      region.snpBuffer?.destroy()
    }
    this.regions.clear()
  }

  render(
    contentBlocks: BaseBlock[],
    regionKeyMap: Map<number, string>,
    viewOffsetPx: number,
    width: number,
    height: number,
    rowHeight: number,
    rowSpacing: boolean,
    coverageHeight: number,
    coverageColor?: [number, number, number],
  ) {
    const device = WebGPUMultiSyntenyRenderer.device
    if (!device) {
      return
    }

    this.resize(width, height)
    const dpr = getDevicePixelRatio()
    const logicalW = this.canvas.width / dpr
    const logicalH = this.canvas.height / dpr
    const rowPadding = rowSpacing ? 1 : 0

    const lookup = (b: BaseBlock) =>
      getRegionForBlock(b, regionKeyMap, this.regions)
    const depthScale = computeDepthScale(
      computeGlobalMaxDepth(contentBlocks, lookup),
    )

    const tv = this.context.getCurrentTexture().createView()
    const BG_CLEAR = { r: BG_COLOR_GL, g: BG_COLOR_GL, b: BG_COLOR_GL, a: 1 }

    let isFirstPass = true
    const submitPass = (pipeline: GPURenderPipeline, bindGroup: GPUBindGroup, instanceCount: number) => {
      const encoder = device.createCommandEncoder()
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: tv,
          loadOp: (isFirstPass ? 'clear' : 'load') as GPULoadOp,
          storeOp: 'store' as GPUStoreOp,
          ...(isFirstPass && { clearValue: BG_CLEAR }),
        }],
      })
      pass.setPipeline(pipeline)
      pass.setBindGroup(0, bindGroup)
      pass.draw(6, instanceCount, 0, 0)
      pass.end()
      device.queue.submit([encoder.finish()])
      isFirstPass = false
    }

    const iterBlocks = () => visibleBlocks(
      contentBlocks, regionKeyMap, this.regions, viewOffsetPx, logicalW,
    )

    // Draw coverage
    if (coverageHeight > 0 && WebGPUMultiSyntenyRenderer.coveragePipeline) {
      const pipeline = WebGPUMultiSyntenyRenderer.coveragePipeline
      for (const [region, params] of iterBlocks()) {
        if (!region.coverageBuffer || !region.coverageBindGroup || region.coverageBinCount === 0) {
          continue
        }
        this.writeUniforms(
          device, logicalW, logicalH, rowHeight,
          params.bpRangeHi, params.bpRangeLo, params.bpRangeLen,
          params.regionScreenLeft, params.regionScreenWidth,
          rowPadding, coverageHeight, depthScale, coverageColor,
        )
        submitPass(pipeline, region.coverageBindGroup, region.coverageBinCount)
      }
    }

    // Draw SNP coverage segments on top of grey coverage
    if (coverageHeight > 0 && WebGPUMultiSyntenyRenderer.snpCoveragePipeline) {
      const pipeline = WebGPUMultiSyntenyRenderer.snpCoveragePipeline
      for (const [region, params] of iterBlocks()) {
        if (!region.snpBuffer || !region.snpBindGroup || region.snpSegmentCount === 0) {
          continue
        }
        this.writeUniforms(
          device, logicalW, logicalH, rowHeight,
          params.bpRangeHi, params.bpRangeLo, params.bpRangeLen,
          params.regionScreenLeft, params.regionScreenWidth,
          rowPadding, coverageHeight, depthScale, coverageColor,
        )
        submitPass(pipeline, region.snpBindGroup, region.snpSegmentCount)
      }
    }

    // Draw synteny instances
    if (WebGPUMultiSyntenyRenderer.fillPipeline) {
      const pipeline = WebGPUMultiSyntenyRenderer.fillPipeline
      for (const [region, params] of iterBlocks()) {
        if (!region.instanceBuffer || !region.instanceBindGroup || region.instanceCount === 0) {
          continue
        }
        this.writeUniforms(
          device, logicalW, logicalH, rowHeight,
          params.bpRangeHi, params.bpRangeLo, params.bpRangeLen,
          params.regionScreenLeft, params.regionScreenWidth,
          rowPadding, coverageHeight, depthScale, coverageColor,
        )
        submitPass(pipeline, region.instanceBindGroup, region.instanceCount)
      }
    }

    if (isFirstPass) {
      const encoder = device.createCommandEncoder()
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: tv,
          loadOp: 'clear' as GPULoadOp,
          storeOp: 'store' as GPUStoreOp,
          clearValue: BG_CLEAR,
        }],
      })
      pass.end()
      device.queue.submit([encoder.finish()])
    }
  }

  pick(_x: number, _y: number) {
    return -1
  }

  dispose() {
    this.clearAllBlocks()
    this.uniformBuffer.destroy()
  }

  private writeUniforms(
    device: GPUDevice,
    width: number,
    height: number,
    rowHeight: number,
    bpRangeHi: number,
    bpRangeLo: number,
    bpRangeLen: number,
    regionScreenLeft: number,
    regionScreenWidth: number,
    rowPadding: number,
    coverageHeight: number,
    depthScale: number,
    coverageColor?: [number, number, number],
  ) {
    fillSyntenyUniforms(
      this.uniformF32, width, height, rowHeight,
      bpRangeHi, bpRangeLo, bpRangeLen,
      regionScreenLeft, regionScreenWidth,
      rowPadding, coverageHeight, depthScale, coverageColor,
    )
    device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData)
  }
}
