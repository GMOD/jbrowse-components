import { getGpuOverride } from '@jbrowse/core/gpu/getGpuDevice'

import { Canvas2DMultiSyntenyRenderer } from './Canvas2DMultiSyntenyRenderer.ts'
import { prepareBlockGeometry, packCoverageForGpu, packSnpCoverageForGpu } from './multiSyntenyGpuData.ts'

import type {
  MultiSyntenyCanvasBackend,
  MultiSyntenyCanvasRenderOpts,
  MultiSyntenyGpuBackend,
  SyntenyColors,
} from './multiSyntenyBackendTypes.ts'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'
import type { SyntenyRegionData } from '../../LinearSyntenyRPC/syntenyRegionTypes.ts'

const cache = new WeakMap<HTMLCanvasElement, MultiSyntenyRenderer>()

export class MultiSyntenyRenderer {
  private canvas: HTMLCanvasElement
  private gpuBackend: MultiSyntenyGpuBackend | null = null
  private canvasBackend: MultiSyntenyCanvasBackend | null = null
  private backendType: 'webgpu' | 'webgl' | 'canvas2d' = 'canvas2d'

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static getOrCreate(canvas: HTMLCanvasElement) {
    let r = cache.get(canvas)
    if (!r) {
      r = new MultiSyntenyRenderer(canvas)
      cache.set(canvas, r)
    }
    return r
  }

  async init() {
    this.gpuBackend?.dispose()
    this.canvasBackend?.dispose()
    this.gpuBackend = null
    this.canvasBackend = null

    if (getGpuOverride() === 'canvas2d') {
      this.canvasBackend = new Canvas2DMultiSyntenyRenderer(this.canvas)
      this.backendType = 'canvas2d'
      return true
    }

    try {
      const { WebGPUMultiSyntenyRenderer } =
        await import('./WebGPUMultiSyntenyRenderer.ts')
      const gpu = await WebGPUMultiSyntenyRenderer.create(this.canvas)
      if (gpu) {
        this.gpuBackend = gpu
        this.backendType = 'webgpu'
        return true
      }
    } catch {
      // WebGPU not available
    }

    try {
      const { WebGLMultiSyntenyRenderer } =
        await import('./WebGLMultiSyntenyRenderer.ts')
      this.gpuBackend = new WebGLMultiSyntenyRenderer(this.canvas)
      this.backendType = 'webgl'
      return true
    } catch {
      // WebGL2 not available
    }

    this.canvasBackend = new Canvas2DMultiSyntenyRenderer(this.canvas)
    this.backendType = 'canvas2d'
    return true
  }

  get isGpu() {
    return this.gpuBackend !== null
  }

  uploadGeometryForBlock(
    blockKey: string,
    regionData: SyntenyRegionData,
    displayedGenomes: string[],
    colorBy: string,
    showSnps: boolean,
    colors: SyntenyColors,
  ) {
    if (this.gpuBackend) {
      const geometry = prepareBlockGeometry(
        regionData.genomeFeatures,
        displayedGenomes,
        colorBy,
        showSnps,
        colors,
      )
      this.gpuBackend.uploadGeometryForBlock(blockKey, {
        ...geometry,
        regionStart: regionData.regionStart,
      })
    }
  }

  uploadCoverageForBlock(
    blockKey: string,
    regionData: SyntenyRegionData,
    viewWidthPx: number,
    globalMaxDepth: number,
  ) {
    if (this.gpuBackend) {
      const packed = packCoverageForGpu(
        regionData.coverageDepths,
        regionData.coverageStartOffset,
        globalMaxDepth,
        regionData.regionStart,
        viewWidthPx,
      )
      this.gpuBackend.uploadCoverageForBlock(blockKey, {
        ...packed,
        regionStart: regionData.regionStart,
        maxDepth: regionData.coverageMaxDepth,
      })
    }
  }

  uploadSnpCoverageForBlock(
    blockKey: string,
    regionData: SyntenyRegionData,
  ) {
    if (this.gpuBackend) {
      const packed = packSnpCoverageForGpu(
        regionData.snpPositions,
        regionData.snpYOffsets,
        regionData.snpHeights,
        regionData.snpColorTypes,
        regionData.snpCount,
        regionData.regionStart,
      )
      this.gpuBackend.uploadSnpCoverageForBlock(blockKey, packed)
    }
  }

  clearAllBlocks() {
    this.gpuBackend?.clearAllBlocks()
  }

  renderGpu(
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
    this.gpuBackend?.render(
      contentBlocks,
      regionKeyMap,
      viewOffsetPx,
      width,
      height,
      rowHeight,
      rowSpacing,
      coverageHeight,
      coverageColor,
    )
  }

  renderCanvas(
    genomeRows: Map<string, MultiPairFeature[]>,
    displayedGenomes: string[],
    opts: MultiSyntenyCanvasRenderOpts,
  ) {
    this.canvasBackend?.render(genomeRows, displayedGenomes, opts)
  }

  dispose() {
    this.gpuBackend?.dispose()
    this.canvasBackend?.dispose()
    this.gpuBackend = null
    this.canvasBackend = null
    cache.delete(this.canvas)
  }
}
