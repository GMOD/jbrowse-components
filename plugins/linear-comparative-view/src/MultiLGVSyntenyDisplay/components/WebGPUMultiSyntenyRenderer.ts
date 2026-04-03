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

import { computeBlockRenderParams } from './multiSyntenyGpuData.ts'
import { YSCALEBAR_LABEL_OFFSET, niceNum } from '@jbrowse/alignments-core'
import {
  UNIFORM_BYTE_SIZE,
  WGSL_FILL_SHADER,
  WGSL_COVERAGE_SHADER,
} from './multiSyntenyGpuShaders.ts'

import type { MultiSyntenyGpuBackend } from './multiSyntenyBackendTypes.ts'
import type { BlockGeometryData, BlockCoverageUploadData } from './multiSyntenyGpuData.ts'
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
}

export class WebGPUMultiSyntenyRenderer implements MultiSyntenyGpuBackend {
  private static device: GPUDevice | null = null
  private static fillPipeline: GPURenderPipeline | null = null
  private static pickingPipeline: GPURenderPipeline | null = null
  private static coveragePipeline: GPURenderPipeline | null = null
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

    ;[
      WebGPUMultiSyntenyRenderer.fillPipeline,
      WebGPUMultiSyntenyRenderer.pickingPipeline,
      WebGPUMultiSyntenyRenderer.coveragePipeline,
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
    ])
  }

  private getRegionForBlock(block: BaseBlock, regionKeyMap: Map<number, string>) {
    if (block.regionNumber === undefined) {
      return undefined
    }
    const key = regionKeyMap.get(block.regionNumber)
    if (!key) {
      return undefined
    }
    return this.regions.get(key)
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

    let region = this.regions.get(blockKey)
    if (region?.instanceBuffer) {
      region.instanceBuffer.destroy()
    }

    if (data.instanceCount === 0) {
      if (region) {
        region.instanceBuffer = null
        region.instanceBindGroup = null
        region.instanceCount = 0
      }
      return
    }

    if (!region) {
      region = {
        regionStart: data.regionStart,
        instanceBuffer: null,
        instanceBindGroup: null,
        instanceCount: 0,
        coverageBuffer: null,
        coverageBindGroup: null,
        coverageBinCount: 0,
        coverageMaxDepth: 0,
      }
      this.regions.set(blockKey, region)
    }

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

    let region = this.regions.get(blockKey)
    if (region?.coverageBuffer) {
      region.coverageBuffer.destroy()
    }

    if (data.binCount === 0) {
      if (region) {
        region.coverageBuffer = null
        region.coverageBindGroup = null
        region.coverageBinCount = 0
        region.coverageMaxDepth = data.maxDepth
      }
      return
    }

    if (!region) {
      region = {
        regionStart: data.regionStart,
        instanceBuffer: null,
        instanceBindGroup: null,
        instanceCount: 0,
        coverageBuffer: null,
        coverageBindGroup: null,
        coverageBinCount: 0,
        coverageMaxDepth: 0,
      }
      this.regions.set(blockKey, region)
    }

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

  clearBlock(blockKey: string) {
    const region = this.regions.get(blockKey)
    if (region) {
      region.instanceBuffer?.destroy()
      region.coverageBuffer?.destroy()
      this.regions.delete(blockKey)
    }
  }

  clearAllBlocks() {
    for (const region of this.regions.values()) {
      region.instanceBuffer?.destroy()
      region.coverageBuffer?.destroy()
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

    let globalMaxDepth = 0
    for (const block of contentBlocks) {
      const region = this.getRegionForBlock(block, regionKeyMap)
      if (region && region.coverageMaxDepth > globalMaxDepth) {
        globalMaxDepth = region.coverageMaxDepth
      }
    }
    const nicedMax = globalMaxDepth > 0 ? niceNum(globalMaxDepth) : 1
    const depthScale = globalMaxDepth > 0 ? globalMaxDepth / nicedMax : 1

    const tv = this.context.getCurrentTexture().createView()

    let isFirstPass = true

    // Draw coverage
    if (
      coverageHeight > 0 &&
      WebGPUMultiSyntenyRenderer.coveragePipeline
    ) {
      for (const block of contentBlocks) {
        const region = this.getRegionForBlock(block, regionKeyMap)
        if (!region?.coverageBuffer || !region.coverageBindGroup || region.coverageBinCount === 0) {
          continue
        }

        const params = computeBlockRenderParams(block, viewOffsetPx)
        if (
          params.regionScreenLeft + params.regionScreenWidth < 0 ||
          params.regionScreenLeft > logicalW
        ) {
          continue
        }

        this.writeUniforms(
          device, logicalW, logicalH, rowHeight,
          params.bpRangeHi, params.bpRangeLo, params.bpRangeLen,
          params.regionScreenLeft, params.regionScreenWidth,
          rowPadding, coverageHeight, depthScale, coverageColor,
        )

        const encoder = device.createCommandEncoder()
        const pass = encoder.beginRenderPass({
          colorAttachments: [{
            view: tv,
            loadOp: isFirstPass ? ('clear' as GPULoadOp) : ('load' as GPULoadOp),
            storeOp: 'store' as GPUStoreOp,
            ...(isFirstPass && { clearValue: { r: 0.93, g: 0.93, b: 0.93, a: 1 } }),
          }],
        })
        pass.setPipeline(WebGPUMultiSyntenyRenderer.coveragePipeline)
        pass.setBindGroup(0, region.coverageBindGroup)
        pass.draw(6, region.coverageBinCount, 0, 0)
        pass.end()
        device.queue.submit([encoder.finish()])
        isFirstPass = false
      }
    }

    // Draw synteny instances
    if (WebGPUMultiSyntenyRenderer.fillPipeline) {
      for (const block of contentBlocks) {
        const region = this.getRegionForBlock(block, regionKeyMap)
        if (!region?.instanceBuffer || !region.instanceBindGroup || region.instanceCount === 0) {
          continue
        }

        const params = computeBlockRenderParams(block, viewOffsetPx)
        if (
          params.regionScreenLeft + params.regionScreenWidth < 0 ||
          params.regionScreenLeft > logicalW
        ) {
          continue
        }

        this.writeUniforms(
          device, logicalW, logicalH, rowHeight,
          params.bpRangeHi, params.bpRangeLo, params.bpRangeLen,
          params.regionScreenLeft, params.regionScreenWidth,
          rowPadding, coverageHeight, depthScale, coverageColor,
        )

        const encoder = device.createCommandEncoder()
        const pass = encoder.beginRenderPass({
          colorAttachments: [{
            view: tv,
            loadOp: isFirstPass ? ('clear' as GPULoadOp) : ('load' as GPULoadOp),
            storeOp: 'store' as GPUStoreOp,
            ...(isFirstPass && { clearValue: { r: 0.93, g: 0.93, b: 0.93, a: 1 } }),
          }],
        })
        pass.setPipeline(WebGPUMultiSyntenyRenderer.fillPipeline)
        pass.setBindGroup(0, region.instanceBindGroup)
        pass.draw(6, region.instanceCount, 0, 0)
        pass.end()
        device.queue.submit([encoder.finish()])
        isFirstPass = false
      }
    }

    if (isFirstPass) {
      const encoder = device.createCommandEncoder()
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: tv,
          loadOp: 'clear' as GPULoadOp,
          storeOp: 'store' as GPUStoreOp,
          clearValue: { r: 0.93, g: 0.93, b: 0.93, a: 1 },
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
    const f = this.uniformF32
    f[0] = width
    f[1] = height
    f[2] = rowHeight
    f[3] = coverageHeight
    f[4] = bpRangeHi
    f[5] = bpRangeLo
    f[6] = bpRangeLen
    f[7] = regionScreenLeft
    f[8] = regionScreenWidth
    f[9] = 0
    f[10] = rowPadding
    f[11] = YSCALEBAR_LABEL_OFFSET
    f[12] = depthScale
    f[13] = coverageColor ? coverageColor[0] : 0.6
    f[14] = coverageColor ? coverageColor[1] : 0.6
    f[15] = coverageColor ? coverageColor[2] : 0.6
    device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData)
  }
}
