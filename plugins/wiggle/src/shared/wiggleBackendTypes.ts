import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'

export type { RenderBlock as WiggleRenderBlock } from '@jbrowse/core/gpu/renderBlock'

export type WiggleRenderingType = 0 | 1 | 2 | 3
export type WiggleScaleType = 0 | 1

export interface WiggleGPURenderState {
  domainY: [number, number]
  scaleType: WiggleScaleType
  renderingType: WiggleRenderingType
  canvasWidth: number
  canvasHeight: number
}

export interface SourceRenderData {
  featurePositions: Uint32Array
  featureScores: Float32Array
  numFeatures: number
  color: [number, number, number]
  rowIndex: number
}

export interface WiggleBackend {
  uploadRegion(
    displayedRegionIndex: number,
    regionStart: number,
    sources: SourceRenderData[],
  ): void
  pruneRegions(activeRegions: number[]): void
  renderBlocks(blocks: RenderBlock[], renderState: WiggleGPURenderState): void
  dispose(): void
}
