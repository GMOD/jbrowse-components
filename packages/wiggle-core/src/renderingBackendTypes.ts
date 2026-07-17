import type { WiggleScaleType } from './normalize.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

export type WiggleRenderingType = 0 | 1 | 2 | 3 | 4

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
  // Stroke thickness in px for line rendering. Default 1 matches the canvas
  // default line width.
  lineWidth: number
  // Score value the xyplot bars pivot around and the density gradient centers
  // on (= the bicolorPivot config slot). Bars grow up for scores above it and
  // down for scores below; default 0 reproduces the fixed-at-zero baseline.
  origin: number
}

export interface SourceRenderData {
  featurePositions: Uint32Array
  featureScores: Float32Array
  numFeatures: number
  color: [number, number, number]
  rowIndex: number
  // Optional per-instance packed ABGR colors. Used by bicolor whiskers, where
  // each band (max/mean/min) is colored by its own value's sign vs the pivot,
  // then tinted. When present it overrides `color` per feature in both backends;
  // `color` stays the single-color fallback (and the legend/first-color source).
  colorsAbgr?: Uint32Array
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
