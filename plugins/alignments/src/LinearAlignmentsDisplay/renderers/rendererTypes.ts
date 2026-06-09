import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { ArcsUploadData } from '../../features/arcs/types.ts'
import type { LinkedReadsMode, ReadConnectionsMode } from '../constants.ts'
import type { ColorPalette } from '../shaders/colors.ts'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
export type { ColorPalette, RGBColor } from '../shaders/colors.ts'
export { interbaseRangeEnds } from '../../shared/uploadTypes.ts'
export type {
  CigarUploadData,
  CoverageUploadData,
  ModCoverageUploadData,
  ReadUploadData,
} from '../../shared/uploadTypes.ts'

export function buildReadIdToIndex(ids: string[], n: number) {
  const m = new Map<string, number>()
  for (let i = 0; i < n; i++) {
    m.set(ids[i]!, i)
  }
  return m
}

export interface RenderState {
  scrollTop: number
  colorScheme: number
  featureHeight: number
  featureSpacing: number
  showCoverage: boolean
  coverageHeight: number
  coverageYOffset: number // padding at top/bottom of coverage area for scalebar labels
  coverageMaxDepth: number | undefined
  coverageIsLog: boolean
  showMismatches: boolean
  filterMismatchesByFrequency: boolean
  showSoftClipping: boolean
  showInterbaseIndicators: boolean
  showModifications: boolean
  showPerBaseQuality: boolean
  showPerBaseLetter: boolean
  // Canvas dimensions - passed in to avoid forced layout from reading clientWidth/clientHeight
  canvasWidth: number
  canvasHeight: number
  // Hover highlight is NOT here — it's a React overlay (HighlightOverlay) so a
  // mousemove repaints only the overlay div, not the canvas. Selection stays
  // canvas-side: it changes on click (rare) and belongs in SVG export.
  selectedFeatureId?: string
  selectedChainIds: string[]
  // Color palette from theme
  colors: ColorPalette
  linkedReads: LinkedReadsMode
  // Straight-line pass connecting normal read-pairs in pileup layout.
  // True when bezier connections are on AND linkedReads === 'off' (pileup).
  // Chain layout has its own connecting-line pass, so this is never needed there.
  showLinkedReadLines: boolean
  flipStrandLongReadChains?: boolean
  readConnectionsLineWidth?: number
  // Genomic bp that map to the arcs band's vertical extent. Arc/bezier mode
  // passes availH/pxPerBp (zoom-proportional); samplot mode passes the
  // autoscaled max |tlen| so Y is zoom-stable. See arc.slang `arcsYDomainBp`.
  arcsYDomainBp?: number
  readConnections: ReadConnectionsMode
  readConnectionsDown?: boolean
  readConnectionsHeight?: number
  pileupTopOffset: number
  showOutline?: boolean
}

export interface AlignmentsSources {
  laidOutPileupMap: ReadonlyMap<number, PileupDataResult>
  arcsRpcDataMap: ReadonlyMap<number, ArcsUploadData>
}

export interface AlignmentsRenderingBackend {
  sync(sources: AlignmentsSources): void
  renderBlocks(blocks: RenderBlock[], state: RenderState): boolean
  dispose(): void
}

export type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'

export function ensureRegion<T>(
  regions: Map<number, T>,
  idx: number,
  factory: () => T,
): T {
  let r = regions.get(idx)
  if (!r) {
    r = factory()
    regions.set(idx, r)
  }
  return r
}

// Vertical placement of the read-connections arc band, computed once so the
// GPU, Canvas2D, and SVG paths can't drift. Arcs anchor at insert-size 0: the
// band bottom in up mode (`down: false`), the band top in down mode.
export interface ArcBand {
  top: number
  height: number
  down: boolean
}

// Decoupled from `showCoverage`: up-mode arcs overlay the coverage band when
// it's shown, otherwise they take their own `readConnectionsHeight` band.
// Down-mode arcs always sit in their own band below coverage. Returns undefined
// when there are no arcs to draw.
export function computeArcBand(state: RenderState): ArcBand | undefined {
  const covH = state.showCoverage ? state.coverageHeight : 0
  const h = state.readConnectionsHeight ?? 0
  if (state.readConnections === 'off' || h === 0) {
    return undefined
  }
  if (state.readConnectionsDown) {
    return { top: covH, height: h, down: true }
  }
  // Up mode: the anchor sits coverageYOffset above the band bottom (the
  // coverage baseline / scalebar-label padding).
  const bandH = covH > 0 ? covH : h
  return { top: 0, height: bandH - state.coverageYOffset, down: false }
}

// Sub-pixel alpha blend: lerp between `base` (full-row coverage) and 1 using
// per-site frequency. Same formula as the three GPU shaders (mismatch /
// gap / insertion). Callers compute `base` from their geometry (pxPerBp or
// widthPx²) then call this once per feature.
export function frequencyAlpha(base: number, frequency: number) {
  return base + frequency * (1 - base)
}

// Canvas Y for a pileup row index, mirroring shader-side `pileupY()` in
// alignmentsUniforms.slang. Single source of truth for the row → canvas-Y
// formula used by every Canvas2D draw method.
export function pileupRowY(yRow: number, state: RenderState) {
  return (
    yRow * (state.featureHeight + state.featureSpacing) +
    state.pileupTopOffset -
    state.scrollTop
  )
}

// Block geometry shared by every Canvas2D feature draw function. Defining
// the shape here breaks an otherwise-cyclic dependency between the per-
// feature drawCanvas modules and Canvas2DAlignmentsRenderer.
export interface DrawBlock {
  start: number
  end: number
  screenStartPx: number
  reversed?: boolean
}

// Linear interpolation from an absolute bp position into the block's screen-
// pixel x. `reversed` blocks flip the mapping (low-bp edge on the right).
export function bpToScreenX(
  absBp: number,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
) {
  const bpEdge = block.reversed ? block.end : block.start
  const offset = block.reversed ? bpEdge - absBp : absBp - bpEdge
  return block.screenStartPx + (offset / bpLength) * fullBlockWidth
}
