import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'
import type { ArcsUploadData } from '../../features/arcs/types.ts'
import type { ColorPalette } from '../../shaders/colors.ts'
import type { ArcColorByType } from '../../shared/types.ts'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
export type { ColorPalette, RGBColor } from '../../shaders/colors.ts'
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
  bpRangeX: [number, number] // absolute genomic positions
  rangeY: [number, number]
  colorScheme: number
  featureHeight: number
  featureSpacing: number
  showCoverage: boolean
  coverageHeight: number
  coverageYOffset: number // padding at top/bottom of coverage area for scalebar labels
  coverageMaxDepth: number | undefined
  coverageIsLog: boolean
  showMismatches: boolean
  showSoftClipping: boolean
  showInterbaseIndicators: boolean
  showModifications: boolean
  // Canvas dimensions - passed in to avoid forced layout from reading clientWidth/clientHeight
  canvasWidth: number
  canvasHeight: number
  highlightedFeatureId?: string
  selectedFeatureId?: string
  highlightedChainIds: string[]
  selectedChainIds: string[]
  // Color palette from theme
  colors: ColorPalette
  renderingMode?: 'pileup' | 'linkedRead' | 'linkedReadBezier'
  flipStrandLongReadChains?: boolean
  reversed?: boolean
  arcLineWidth?: number
  arcColorByType?: ArcColorByType
  // Genomic bp that map to the arcs band's vertical extent. Arc/bezier mode
  // passes availH/pxPerBp (zoom-proportional); samplot mode passes the
  // autoscaled max |tlen| so Y is zoom-stable. See arc.slang `arcsYDomainBp`.
  arcsYDomainBp?: number
  // Show arcs alongside pileup (between coverage and reads)
  showArcs?: boolean
  arcsHeight?: number
  pairedArcsDown: boolean
  pileupTopOffset: number
  showOutline?: boolean
}

export interface AlignmentsSources {
  laidOutPileupMap: ReadonlyMap<number, PileupDataResult>
  arcsRpcDataMap: ReadonlyMap<number, ArcsUploadData>
}

export interface AlignmentsBackend {
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

export function computeBlockHeights(state: RenderState) {
  return {
    effectiveArcsHeight:
      state.showArcs && state.arcsHeight ? state.arcsHeight : 0,
    covH: state.showCoverage ? state.coverageHeight : 0,
  }
}

// Canvas Y for a pileup row index, mirroring shader-side `pileupY()` in
// alignmentsUniforms.slang. Single source of truth for the row → canvas-Y
// formula used by every Canvas2D draw method.
export function pileupRowY(yRow: number, state: RenderState) {
  return (
    yRow * (state.featureHeight + state.featureSpacing) +
    state.pileupTopOffset -
    state.rangeY[0]
  )
}

// Block geometry shared by every Canvas2D feature draw function. Defining
// the shape here breaks an otherwise-cyclic dependency between the per-
// feature drawCanvas modules and Canvas2DAlignmentsRenderer.
export interface DrawBlock {
  bpRangeX: [number, number]
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
  const bpEdge = block.reversed ? block.bpRangeX[1] : block.bpRangeX[0]
  const offset = block.reversed ? bpEdge - absBp : absBp - bpEdge
  return block.screenStartPx + (offset / bpLength) * fullBlockWidth
}
