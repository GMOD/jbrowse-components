import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

import { Canvas2DMultiSyntenyRenderer } from './Canvas2DMultiSyntenyRenderer.ts'
import {
  GpuMultiSyntenyRenderer,
  SYNTENY_PASSES,
  SYNTENY_UNIFORM_BYTE_SIZE,
} from './GpuMultiSyntenyRenderer.ts'
import {
  packCoverageForGpu,
  packIndicatorsForGpu,
  packSnpCoverageForGpu,
  prepareBlockGeometry,
} from './multiSyntenyGpuData.ts'

import type {
  MultiSyntenyBackend,
  MultiSyntenyRenderState,
  SyntenyColors,
} from './multiSyntenyBackendTypes.ts'
import type { SyntenyRegionData } from '../../LinearSyntenyRPC/syntenyRegionTypes.ts'

export class MultiSyntenyRenderer {
  private canvas: HTMLCanvasElement
  private backend: MultiSyntenyBackend | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static getOrCreate(canvas: HTMLCanvasElement) {
    return new MultiSyntenyRenderer(canvas)
  }

  async init() {
    this.backend = await initDualBackend<MultiSyntenyBackend>(
      this.canvas,
      SYNTENY_PASSES,
      SYNTENY_UNIFORM_BYTE_SIZE,
      hal => new GpuMultiSyntenyRenderer(hal),
      canvas => new Canvas2DMultiSyntenyRenderer(canvas),
    )
    return true
  }

  uploadGeometryForBlock(
    regionNumber: number,
    regionData: SyntenyRegionData,
    displayedGenomes: string[],
    colorBy: string,
    showSnps: boolean,
    colors: SyntenyColors,
  ) {
    const geometry = prepareBlockGeometry(
      regionData.genomeFeatures,
      displayedGenomes,
      colorBy,
      showSnps,
      colors,
    )
    this.backend?.uploadGeometryForBlock(regionNumber, {
      ...geometry,
      regionStart: regionData.regionStart,
    })
  }

  uploadCoverageDataForBlock(
    regionNumber: number,
    regionData: SyntenyRegionData,
    viewWidthPx: number,
    globalMaxDepth: number,
  ) {
    const coverage = packCoverageForGpu(
      regionData.coverageDepths,
      regionData.coverageStartOffset,
      globalMaxDepth,
      regionData.regionStart,
      viewWidthPx,
    )
    this.backend?.uploadCoverageForBlock(regionNumber, {
      ...coverage,
      regionStart: regionData.regionStart,
      maxDepth: regionData.coverageMaxDepth,
    })
    const snps = packSnpCoverageForGpu(
      regionData.snpPositions,
      regionData.snpYOffsets,
      regionData.snpHeights,
      regionData.snpColorTypes,
      regionData.snpCount,
      regionData.regionStart,
    )
    this.backend?.uploadSnpCoverageForBlock(regionNumber, snps)
    const indicators = packIndicatorsForGpu(
      regionData.indicatorPositions,
      regionData.numIndicators,
      regionData.regionStart,
    )
    this.backend?.uploadIndicatorsForBlock(regionNumber, indicators)
  }

  clearAllBlocks() {
    this.backend?.clearAllBlocks()
  }

  renderBlocks(state: MultiSyntenyRenderState) {
    this.backend?.renderBlocks(state)
  }

  dispose() {
    this.backend?.dispose()
    this.backend = null
  }
}
