import { createGpuHal } from '@jbrowse/core/gpu/hal'

import { Canvas2DMultiSyntenyRenderer } from './Canvas2DMultiSyntenyRenderer.ts'
import {
  GpuMultiSyntenyRenderer,
  SYNTENY_PASSES,
  SYNTENY_UNIFORM_BYTE_SIZE,
} from './GpuMultiSyntenyRenderer.ts'
import { prepareBlockGeometry, packCoverageForGpu, packSnpCoverageForGpu, packIndicatorsForGpu } from './multiSyntenyGpuData.ts'

import type {
  GpuRenderOpts,
  MultiSyntenyCanvasBackend,
  MultiSyntenyCanvasRenderOpts,
  MultiSyntenyGpuBackend,
  SyntenyColors,
} from './multiSyntenyBackendTypes.ts'
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

    const hal = await createGpuHal(
      this.canvas,
      SYNTENY_PASSES,
      SYNTENY_UNIFORM_BYTE_SIZE,
    )
    if (hal) {
      this.gpuBackend = new GpuMultiSyntenyRenderer(hal)
      this.backendType = 'webgpu'
      return true
    }

    this.canvasBackend = new Canvas2DMultiSyntenyRenderer(this.canvas)
    this.backendType = 'canvas2d'
    return true
  }

  get isGpu() {
    return this.gpuBackend !== null
  }

  uploadGeometryForBlock(
    regionNumber: number,
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
      this.gpuBackend.uploadGeometryForBlock(regionNumber, {
        ...geometry,
        regionStart: regionData.regionStart,
      })
    }
  }

  uploadCoverageForBlock(
    regionNumber: number,
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
      this.gpuBackend.uploadCoverageForBlock(regionNumber, {
        ...packed,
        regionStart: regionData.regionStart,
        maxDepth: regionData.coverageMaxDepth,
      })
    }
  }

  uploadSnpCoverageForBlock(
    regionNumber: number,
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
      this.gpuBackend.uploadSnpCoverageForBlock(regionNumber, packed)
    }
  }

  uploadIndicatorsForBlock(
    regionNumber: number,
    regionData: SyntenyRegionData,
  ) {
    if (this.gpuBackend) {
      const packed = packIndicatorsForGpu(
        regionData.indicatorPositions,
        regionData.numIndicators,
        regionData.regionStart,
      )
      this.gpuBackend.uploadIndicatorsForBlock(regionNumber, packed)
    }
  }

  clearAllBlocks() {
    this.gpuBackend?.clearAllBlocks()
  }

  renderGpu(opts: GpuRenderOpts) {
    this.gpuBackend?.render(opts)
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
