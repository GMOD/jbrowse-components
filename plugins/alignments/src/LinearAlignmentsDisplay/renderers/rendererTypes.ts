import { makeCellLeftMapper } from '@jbrowse/render-core/canvas2dUtils'

import {
  frequencyFadeGate,
  sizeAlpha,
} from '../../shaders/slang/alignmentsUniforms.js.generated.ts'
import { intronAlpha } from '../../shaders/slang/gap.js.generated.ts'
import { READ_OUTLINE_MIN_HEIGHT_PX } from '../../shaders/slang/read.consts.generated.ts'
import { readIdAt } from '../../shared/readIdentity.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { ArcsUploadData } from '../../features/arcs/types.ts'
import type { ColorPalette } from '../../shaders/colors.ts'
import type { ReadIdentity } from '../../shared/readIdentity.ts'
import type { ReadConnectionsMode } from '../constants.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { RenderingBackend } from '@jbrowse/render-core/renderingBackendBase'
import type { WiggleScaleType } from '@jbrowse/wiggle-core'

export type { ColorPalette, RGBColor } from '../../shaders/colors.ts'
export { interbaseRangeEnds } from '../../shared/uploadTypes.ts'
export type {
  CigarUploadData,
  CoverageUploadData,
  ModCoverageUploadData,
  ReadUploadData,
} from '../../shared/uploadTypes.ts'

export function buildReadIdToIndex(d: ReadIdentity) {
  const m = new Map<string, number>()
  for (let i = 0; i < d.readKeys.length; i++) {
    m.set(readIdAt(d, i)!, i)
  }
  return m
}

// Its only consumers are the chain/selection overlay bounds, which do nothing
// unless a read is hovered or selected — so on a cold render the map is built
// over every fetched read and never read. At ultra-deep coverage that made it
// the single largest main-thread cost (~104ms of 660ms busy). Deferring to the
// first lookup keeps it off the initial-render path; `model.readIdIndexMap` is
// gated the same way one layer up.
//
// It is also where the id STRINGS get built at all, now that the worker ships
// keys (shared/readIdentity.ts) — the overlays match against
// `featureIdUnderMouse`, which is a string. Same deferral, so a cold render
// still builds none of them.
export function lazyReadIdToIndex(d: ReadIdentity) {
  let map: Map<string, number> | undefined
  return () => {
    if (map === undefined) {
      map = buildReadIdToIndex(d)
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
  // The autoscaled coverage domain, `coverageDomain[0]` and `[1]`. Both ends,
  // because a `minScore` bound moves the baseline the bars draw flat at — for a
  // long time only the max was carried here and the min was silently dropped, so
  // the setting did nothing. `undefined` until the debounced autoscale resolves;
  // `makeCoverageScale` is the one place they are read, and reads them together.
  coverageMinDepth: number | undefined
  coverageMaxDepth: number | undefined
  coverageScaleType: WiggleScaleType
  coverageSymlogConstant: number
  // Allele-fraction floor for the band's coloured segments: a segment whose
  // share of its position's depth is below this is not drawn, and the grey
  // depth bar shows through where it would have been. 0 colours every
  // mismatch. Nothing to do with `filterMismatchesByFrequency`, which is the
  // PILEUP's depth-dependent fade.
  coverageSnpMinFrequency: number
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
  // Every READ of the selected chain, keyed the same way as `selectedFeatureId`
  // — `getSelectionBounds` resolves both through `readIdToIndex`. Not chain
  // ids: `chainNames` is that space, and nothing in the renderers holds one.
  selectedChainReadIds: string[]
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
const SECTION_KEY_STRIDE = 1 << 20

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
  // The configured arc stroke width — the same number `RenderState` carries,
  // and deliberately in both places. The GPU resolves each arc's width from its
  // read support when it PACKS the instance (`packArcs`), so for that backend
  // this is an upload-tier input: the upload autorun has to read it here or a
  // width change never repacks. Canvas2D has no upload tier and applies it per
  // arc at draw time, off the render state.
  readConnectionsLineWidth: number
}

// Whole-map synced, and the only one: one `sources` cell rebuilds every region
// together because pileup Y-rows must be assigned consistently across regions.
export interface AlignmentsRenderingBackend extends RenderingBackend {
  upload(key: 'sources', sources: AlignmentsSources): void
  release(key: 'sources'): void
  renderBlocks(blocks: RenderBlock[], state: RenderState): boolean
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

// The fields `computeArcBand` reads. Narrower than `RenderState` so the LAYOUT
// can place the band without depending on the full render state, which also
// needs the color palette to exist — and the layout runs before there is one.
//
// It was narrowed for the insert-size ruler, which used to assemble a band of
// its own from these. It no longer does: a ruler per section has to read the
// band the layout placed, since only that one knows where each section's is.
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
  // Up mode overlays the coverage histogram when there is one, so the arcs'
  // zero anchor has to be the coverage BASELINE — which sits coverageYOffset
  // above the band bottom, that being the inset the scalebar labels reserve.
  //
  // With coverage hidden the band is the arcs' own and there is no baseline to
  // meet, so the inset is a constant borrowed from an absent band: it left the
  // arcs floating coverageYOffset px above the bottom of the strip
  // `reservesArcsBand` had already reserved for them, and took the same px off
  // `availH`. Down mode never subtracted it, which is the tell.
  //
  // This picks where the band's height comes from; it is not a `covH > 0` gate
  // on whether arcs draw — that decoupling is the point of this function.
  const bandH = covH > 0 ? covH - state.coverageYOffset : h
  return { top: 0, height: bandH, down: false }
}

// The fields `shouldDrawOverlaps` reads. Narrower than `RenderState` for the
// same reason `ArcBandInput` is — so the state model can ask the question
// without assembling a render state, which it does to decide whether the legend
// names the tint. A legend row explaining a darkness the pass isn't drawing is
// the failure this shares rather than restates.
export interface OverlapDrawInput {
  chainMode: boolean
  collapseGroupRows: boolean
  featureHeight: number
}

// Whether to draw the overlap tint pass. Shared by both renderers so the gate
// can't drift between them. Meaningful in the two layouts that put more than one
// feature on a row — a linked-reads chain, or a collapsed group — and suppressed
// below 3px row height where the tint is sub-pixel noise.
export function shouldDrawOverlaps(state: OverlapDrawInput) {
  return (
    (state.chainMode || state.collapseGroupRows) && state.featureHeight >= 3
  )
}

// Whether reads get an outline at all, for a whole frame. Shared by both
// renderers for the same reason as `shouldDrawOverlaps`, and this one has the
// scar to show for not having been: the height rule was written three times —
// `>= 4` in `GpuAlignmentsRenderer`, `> READ_OUTLINE_MIN_PX` (2) in read.slang's
// fragment stage, and `> READ_OUTLINE_MIN_PX` again in the Canvas2D painter.
// Sharing the *constant* had not been enough, because what drifted was which
// number and which comparison, not the name.
//
// Only the host's `>= 4` ever bound on the GPU: the shader gets height as
// `u.featHeight` and copies it into every read's `featSize.y`, so its own y test
// could never disagree with the uniform that had already zeroed `showStroke`.
// That made it dead code, and dead code is a bad thing to copy — which is what
// the canvas painter did, giving Compact (3px reads, and no inter-read gap at
// that size) an outline on Canvas2D and in the SVG export but not on screen.
//
// The width half stays per-read and lives at each call site, since it is a
// property of one read rather than of the frame.
export function shouldOutlineReads(state: RenderState) {
  return state.showOutline && state.featureHeight >= READ_OUTLINE_MIN_HEIGHT_PX
}

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
// it doesn't mean "opaque").
//
// The gate itself is `frequencyFadeGate`, generated from
// alignmentsUniforms.slang — so is the lerp inside it — leaving this function
// with the two things that are genuinely the CPU side's: reading the toggle off
// the render state, and normalizing the frequency byte the worker packs.
export function frequencyFade(
  state: RenderState,
  base: number,
  frequencyByte: number,
) {
  return frequencyFadeGate(
    base,
    frequencyByte / 255,
    state.filterMismatchesByFrequency,
  )
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
// The indel size gate, alongside `frequencyFade` because every pass that wants
// one wants the other — they multiply. Generated from alignmentsUniforms.slang
// so the two backends cannot disagree (adr-051).
export { sizeAlpha }

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
