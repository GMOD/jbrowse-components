import type { WiggleScaleType } from './normalize.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

export type WiggleRenderingType = 0 | 1 | 2 | 3

export interface WiggleGPURenderState {
  domainY: [number, number]
  scaleType: WiggleScaleType
  renderingType: WiggleRenderingType
  canvasWidth: number
  canvasHeight: number
  // Authoritative row count from the model (overlay = 1, else numSources).
  // Drives rowHeight in both backends so it matches getRowHeight/findHit even
  // when a source has no features in the visible region.
  numRows: number
  // Full height in px of a scatterplot point (the point spans scoreY ± size/2).
  // Default 2 reproduces the previous hardcoded scoreY±1 band.
  scatterPointSize: number
}

export interface SourceRenderData {
  featurePositions: Uint32Array
  featureScores: Float32Array
  numFeatures: number
  color: [number, number, number]
  rowIndex: number
}

export interface WiggleRenderingBackend {
  uploadRegion(displayedRegionIndex: number, sources: SourceRenderData[]): void
  pruneRegions(activeRegions: number[]): void
  renderBlocks(
    blocks: RenderBlock[],
    regions: ReadonlyMap<number, SourceRenderData[]>,
    renderState: WiggleGPURenderState,
  ): void
  dispose(): void
}
