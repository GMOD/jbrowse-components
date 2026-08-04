import { makeCellLeftMapper } from '@jbrowse/render-core/canvas2dUtils'

import { frequencyAlpha } from '../shaders/slang/alignmentsUniforms.js.generated.ts'
import { intronAlpha } from '../shaders/slang/gap.js.generated.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { ArcsUploadData } from '../../features/arcs/types.ts'
import type { ReadConnectionsMode } from '../constants.ts'
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

// Its only consumers are the chain/selection overlay bounds, which do nothing
// unless a read is hovered or selected — so on a cold render the map is built
// over every fetched read and never read. At ultra-deep coverage that made it
// the single largest main-thread cost (~104ms of 660ms busy). Deferring to the
// first lookup keeps it off the initial-render path; `model.readIdIndexMap` is
// gated the same way one layer up.
export function lazyReadIdToIndex(ids: string[]) {
  let map: Map<string, number> | undefined
  return () => {
    if (map === undefined) {
      map = buildReadIdToIndex(ids, ids.length)
    }
    return map
  }
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
  // Fade mismatch bases by their per-base Phred quality (advanced setting).
  mismatchAlpha: boolean
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
  // Chain (linked-reads) layout is active. The `linkedReads` enum stops at the
  // model — renderers only ever ask the yes/no question, so they get the
  // already-resolved `isChainMode` and the two spellings can't drift.
  chainMode: boolean
  // Straight-line pass connecting normal read-pairs in pileup layout.
  // True when bezier connections are on AND chain mode is off (pileup).
  // Chain layout has its own connecting-line pass, so this is never needed there.
  showLinkedReadLines: boolean
  // Each group drawn as one row, so features that would have stacked share it.
  // The overlap tint is what makes that depth readable, hence a second reason
  // (besides chain mode) for that layer to draw.
  collapseGroupRows: boolean
  // NOT here: flipStrandLongReadChains / colorSupplementaryChains. Both feed
  // read classification only, which now happens once on the CPU
  // (readColorCategories) — the renderers receive the resulting category and
  // never re-decide. Carrying them would make two layout-tier settings
  // needlessly invalidate the canvas as well.
  readConnectionsLineWidth: number
  // Genomic bp that map to the arcs band's vertical extent. Arc/bezier mode
  // passes availH/pxPerBp (zoom-proportional); read-cloud mode passes the
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

// Whether to draw the overlap tint pass. Shared by both renderers so the gate
// can't drift between them. Meaningful in the two layouts that put more than one
// feature on a row — a linked-reads chain, or a collapsed group — and suppressed
// below 3px row height where the tint is sub-pixel noise.
export function shouldDrawOverlaps(state: RenderState) {
  return (
    (state.chainMode || state.collapseGroupRows) && state.featureHeight >= 3
  )
}

// Sub-pixel alpha blend: lerp between `base` (full-row coverage) and 1 using
// per-site frequency. `frequencyAlpha` is generated from
// alignmentsUniforms.slang by `pnpm gen:shaders` (adr-051), so this is the
// shader's own formula rather than a copy of it.

// The whole low-frequency fade gate for one feature: honors the
// "show low frequency mismatches" toggle, skips features that already cover a
// full pixel, and normalizes the frequency byte. Callers pass `base` from their
// geometry: `pxPerBp` for 1bp marks (mismatch, clip), `pxPerBp²` for the 1bp
// insertion point-marker (squared so a narrow insertion fades faster than a
// mismatch at the same zoom), and `widthPx²` for the multi-bp gap deletion — its
// OWN on-screen span squared, NOT `pxPerBp²`, so a wide deletion stays opaque
// when zoomed out instead of fading like a single base. Both the GPU
// (gap.slang) and Canvas2D (drawGaps) pass `widthPx²`; keep them together.
// Squaring only changes the fade *rate*: a feature is sub-pixel exactly when
// base < 1, i.e. when the underlying width (`pxPerBp` for marks/insertions,
// `widthPx` for deletions) is < 1, so the gate fires on the same features.
//
// Every fading pass must go through this rather than reassembling the gate
// locally: hand-rolled copies are how the clip pass silently lost its toggle
// check and how the softclip-base pass fed 0 into the lerp (0 fades to nothing,
// it doesn't mean "opaque"). Mirrors frequencyFade() in alignmentsUniforms.slang.
export function frequencyFade(
  state: RenderState,
  base: number,
  frequencyByte: number,
) {
  return state.filterMismatchesByFrequency && base < 1
    ? frequencyAlpha(base, frequencyByte / 255)
    : 1
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
// Private on purpose: a width alone invites pairing it with a bare
// `bpToScreenX`, which is the reversed-block bug makePileupCellMapper exists to
// prevent. Go through the mapper — it hands back the matching left edge.
function pileupCellWidth(bpPerPx: number, contiguous: boolean) {
  return Math.max(1, 1 / bpPerPx) + (contiguous ? PILEUP_CELL_SEAM_FUDGE_PX : 0)
}

/**
 * Per-block mapper for the 1bp-cell painters (mismatch, modification, per-base
 * quality/letter, soft-clip bases): `cellX(bp)` is the LEFT edge of base `bp`'s
 * cell and `w` its width.
 *
 * Returning both together is the point — a bare width invites pairing it with a
 * bare `bpToScreenX`, which is the reversed-block bug that hit all five layers
 * (see `makeCellLeftMapper`, which owns the pivot for every plugin). Width stays
 * local because the floor-and-seam-fudge rule is ours alone.
 *
 * `bpLength`/`fullBlockWidth` are the same block's clip-derived span
 * (`clipBlockForCanvas` defines them as `end - start` / `screenEndPx -
 * screenStartPx`), so reconstructing `screenEndPx` here is exact.
 */
export function makePileupCellMapper(
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  contiguous: boolean,
) {
  return {
    w: pileupCellWidth(bpLength / fullBlockWidth, contiguous),
    cellX: makeCellLeftMapper({
      start: block.start,
      end: block.start + bpLength,
      screenStartPx: block.screenStartPx,
      screenEndPx: block.screenStartPx + fullBlockWidth,
      reversed: block.reversed,
    }),
  }
}

// Introns (skip/N gaps) draw as 1px centerlines; once reads get compact the
// per-row centerlines pack together into a solid smear, so they fade as the
// read height shrinks. The curve is gap.slang's — generated in by
// `pnpm gen:shaders` (adr-051), where the two used to be a hand-expanded
// smoothstep and a `smoothstep()` call under matching "keep these in sync"
// comments. Re-exported here because this is where the draw path imports it.
export { intronAlpha }

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

// A pileup row painted at screen-Y `y` spans [y, y + featureHeight]. When that
// band can't reach the drawing buffer [0, canvasHeight] the row is off-canvas:
// the renderer's `ctx.clip()` already masks its pixels, so skipping the draw in
// JS is output-identical. This is what keeps Canvas2D scroll cost proportional
// to *visible* rows rather than *total* pileup depth — without it every
// per-row/per-base draw pass issued a fill for all ~N rows every scroll frame
// (the deep-coverage redraw cost). The 1px pad covers the sub-pixel stroke edges
// of read outlines/clip bars; nothing draws further outside the vertical band
// (chevrons extend horizontally, not vertically).
export function pileupRowOffCanvas(y: number, state: RenderState) {
  return y + state.featureHeight < -1 || y > state.canvasHeight + 1
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
