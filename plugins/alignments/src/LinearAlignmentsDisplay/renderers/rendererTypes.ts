import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { ArcsUploadData } from '../../features/arcs/types.ts'
import type { LinkedReadsMode, ReadConnectionsMode } from '../constants.ts'
import type { ColorPalette } from '../shaders/colors.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
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
  flipStrandLongReadChains: boolean
  // Opt-in legacy behavior: paint paired supplementary chains a flat
  // supplementary color (hides pair orientation). Off by default.
  colorSupplementaryChains: boolean
  readConnectionsLineWidth: number
  // Genomic bp that map to the arcs band's vertical extent. Arc/bezier mode
  // passes availH/pxPerBp (zoom-proportional); samplot mode passes the
  // autoscaled max |tlen| so Y is zoom-stable. See arc.slang `arcsYDomainBp`.
  arcsYDomainBp?: number
  readConnections: ReadConnectionsMode
  readConnectionsDown: boolean
  readConnectionsHeight: number
  // Pileup row 0 top, screen px before scrollTop subtraction (GPU `covOffset`
  // uniform, Canvas2D `pileupRowY` base). For ungrouped this is the sticky
  // coverage height; the renderers override it per section while looping.
  pileupTopOffset: number
  // Screen px of the coverage area's top edge (GPU `covTop` uniform; added to
  // Canvas2D coverage draws). 0 = sticky-at-top (ungrouped). Grouped sections
  // pass their scrolled coverage top so the band scrolls with its section.
  coverageTopOffset: number
  // Per-section vertical geometry, in stacking order matching
  // `AlignmentsSources.sections`. Always length >= 1; ungrouped is one section.
  // The renderers loop these, cloning the per-section offsets into the state
  // they hand the draw helpers and clipping to each band.
  sections: SectionRender[]
  showOutline: boolean
}

// One stacked section's resolved screen-space draw geometry. All values are
// screen px (scrollTop already applied for grouped sections). Ungrouped is a
// single section whose values reproduce the pre-grouping layout exactly.
export interface SectionRender {
  pileupTopOffset: number
  coverageTopOffset: number
  // Clip band for the coverage passes.
  covClipTop: number
  covClipHeight: number
  // Clip band for the pileup passes.
  pileupClipTop: number
  pileupClipHeight: number
  // Screen-space paired-end arc band for this section, or undefined when arcs
  // are off / this section reserves none. Ungrouped is sticky (not scrolled);
  // grouped scrolls with its section, matching coverage.
  arcBand?: ArcBand
}

// HAL/region key namespacing: section 0 keys equal the raw displayedRegionIndex
// so the ungrouped path is byte-identical to pre-grouping. Higher sections are
// offset by a stride larger than any region count or the overlay-region id.
export const SECTION_KEY_STRIDE = 1 << 20

export function sectionRegionKey(sectionIdx: number, regionIdx: number) {
  return sectionIdx * SECTION_KEY_STRIDE + regionIdx
}

// Each stacked section draws with its own vertical offsets. Shared by both
// renderers so the per-section override list can't drift between backends.
export function sectionRenderState(
  state: RenderState,
  sec: SectionRender,
): RenderState {
  return {
    ...state,
    pileupTopOffset: sec.pileupTopOffset,
    coverageTopOffset: sec.coverageTopOffset,
  }
}

export interface SectionSource {
  groupKey: string
  laidOutPileupMap: ReadonlyMap<number, PileupDataResult>
  // This group's paired-end arc upload feed (region idx → arcs). Empty when
  // read-connections are off. Per-section so each grouped band draws its own
  // arcs; ungrouped is the single section's feed.
  arcsRpcDataMap: ReadonlyMap<number, ArcsUploadData>
}

export interface AlignmentsSources {
  // One entry per stacked group, in stacking order. Ungrouped = single entry
  // (groupKey ''). Parallel to `RenderState.sections`.
  sections: SectionSource[]
}

export interface AlignmentsRenderingBackend {
  sync(sources: AlignmentsSources): void
  renderBlocks(blocks: RenderBlock[], state: RenderState): boolean
  dispose(): void
}

export type { RenderBlock } from '@jbrowse/render-core/renderBlock'

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

// The fields `computeArcBand` reads. Narrower than `RenderState` so the model's
// `insertSizeTicks` getter can build the band from raw fields without depending
// on the full render state (which also needs the color palette to exist).
export interface ArcBandInput {
  showCoverage: boolean
  coverageHeight: number
  coverageYOffset: number
  readConnections: ReadConnectionsMode
  readConnectionsDown?: boolean
  readConnectionsHeight?: number
}

// Decoupled from `showCoverage`: up-mode arcs overlay the coverage band when
// it's shown, otherwise they take their own `readConnectionsHeight` band.
// Down-mode arcs always sit in their own band below coverage. Returns undefined
// when there are no arcs to draw.
export function computeArcBand(state: ArcBandInput): ArcBand | undefined {
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

// Whether to draw the mate-overlap hatching pass. Shared by both renderers so
// the gate can't drift between them. Only meaningful in a linked-reads layout,
// and suppressed below 3px row height where the hatching is sub-pixel noise.
export function shouldDrawOverlaps(state: RenderState) {
  return state.linkedReads !== 'off' && state.featureHeight >= 3
}

// Sub-pixel alpha blend: lerp between `base` (full-row coverage) and 1 using
// per-site frequency. Same formula as the three GPU shaders (mismatch /
// gap / insertion). Callers compute `base` from their geometry (pxPerBp or
// widthPx²) then call this once per feature.
export function frequencyAlpha(base: number, frequency: number) {
  return base + frequency * (1 - base)
}

// Width (CSS px) of one 1bp pileup cell for the Canvas2D "colored rect per base"
// layers (mismatch, modification, per-base quality/letter, soft-clip bases). At
// least 1px so sub-pixel-narrow bases stay visible. `contiguous` adds a
// half-pixel seam fudge for the layers that paint an unbroken wall of abutting
// cells (per-base quality/letter, soft-clip runs): Canvas2D anti-aliases each
// cell's fractional edges, and two abutting AA'd edges don't sum to full
// opacity, leaving a hairline seam — the overdraw closes it. Sparse marks
// (mismatch, modification) never abut, so they pass `contiguous: false`. The GPU
// tiles pixel-snapped quads seamlessly and needs no fudge, so this is a
// Canvas2D-only compensation; keeping it here means every base-wall layer shares
// one rule instead of hardcoding (or forgetting) the `+ 0.5` locally.
const PILEUP_CELL_SEAM_FUDGE_PX = 0.5
export function pileupCellWidth(bpPerPx: number, contiguous: boolean) {
  return Math.max(1, 1 / bpPerPx) + (contiguous ? PILEUP_CELL_SEAM_FUDGE_PX : 0)
}

// Introns (skip/N gaps) draw as 1px centerlines; once reads get compact the
// per-row centerlines pack together into a solid smear. Fade them toward
// `INTRON_MIN_ALPHA` as `featureHeight` shrinks so dense splice pileups stay
// legible. Full opacity at the default height (7px); only the compact end
// fades. Mirrored in gap.slang — keep the smoothstep bounds and floor in sync.
const INTRON_FADE_MIN_PX = 1
const INTRON_FADE_MAX_PX = 4
const INTRON_MIN_ALPHA = 0.25
export function intronAlpha(featureHeight: number) {
  const t = Math.min(
    1,
    Math.max(
      0,
      (featureHeight - INTRON_FADE_MIN_PX) /
        (INTRON_FADE_MAX_PX - INTRON_FADE_MIN_PX),
    ),
  )
  const smooth = t * t * (3 - 2 * t)
  return INTRON_MIN_ALPHA + (1 - INTRON_MIN_ALPHA) * smooth
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
