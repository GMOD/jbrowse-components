import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

import { Canvas2DMultiSyntenyRenderer } from './Canvas2DMultiSyntenyRenderer.ts'
import {
  GpuMultiSyntenyRenderer,
  SYNTENY_PASSES,
  SYNTENY_UNIFORM_BYTE_SIZE,
} from './GpuMultiSyntenyRenderer.ts'
import { prepareBlockGeometry, packCoverageForGpu, packSnpCoverageForGpu, packIndicatorsForGpu } from './multiSyntenyGpuData.ts'

import type {
  MultiSyntenyBackend,
  MultiSyntenyRenderState,
  SyntenyColors,
} from './multiSyntenyBackendTypes.ts'
import type { SyntenyRegionData } from '../../LinearSyntenyRPC/syntenyRegionTypes.ts'

const cache = new WeakMap<HTMLCanvasElement, MultiSyntenyRenderer>()

export class MultiSyntenyRenderer {
  private canvas: HTMLCanvasElement
  private backend: MultiSyntenyBackend | null = null

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
    if (this.backend) {
      const geometry = prepareBlockGeometry(
        regionData.genomeFeatures,
        displayedGenomes,
        colorBy,
        showSnps,
        colors,
      )
      this.backend.uploadGeometryForBlock(regionNumber, {
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
    if (this.backend) {
      const packed = packCoverageForGpu(
        regionData.coverageDepths,
        regionData.coverageStartOffset,
        globalMaxDepth,
        regionData.regionStart,
        viewWidthPx,
      )
      this.backend.uploadCoverageForBlock(regionNumber, {
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
    if (this.backend) {
      const packed = packSnpCoverageForGpu(
        regionData.snpPositions,
        regionData.snpYOffsets,
        regionData.snpHeights,
        regionData.snpColorTypes,
        regionData.snpCount,
        regionData.regionStart,
      )
      this.backend.uploadSnpCoverageForBlock(regionNumber, packed)
    }
  }

  uploadIndicatorsForBlock(
    regionNumber: number,
    regionData: SyntenyRegionData,
  ) {
    if (this.backend) {
      const packed = packIndicatorsForGpu(
        regionData.indicatorPositions,
        regionData.numIndicators,
        regionData.regionStart,
      )
      this.backend.uploadIndicatorsForBlock(regionNumber, packed)
    }
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
    cache.delete(this.canvas)
  }
}
