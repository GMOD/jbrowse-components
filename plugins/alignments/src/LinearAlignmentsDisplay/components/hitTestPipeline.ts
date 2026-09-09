import { coverageBinAt, hitCoverageBand } from '@jbrowse/alignments-core'
import { bpAtPx, bpAtPxExact } from '@jbrowse/render-core/canvas2dUtils'

import { CLIP_MARK, clipHit, clipsOfKind } from '../../features/clip/mark.ts'
import { DELETION_MARK, SKIP_MARK, gapHit } from '../../features/gap/mark.ts'
import {
  INSERTION_MARK,
  insertionHit,
  insertionsOfSize,
} from '../../features/insertion/mark.ts'
import { MISMATCH_MARK, mismatchHit } from '../../features/mismatch/mark.ts'
import { hitTestModification } from '../../features/modification/hitTest.ts'
import { backToFront } from '../../features/pileupShape.ts'
import { hitTestFeature } from '../../features/read/hitTest.ts'
import { SOFTCLIP_BASES_MARK } from '../../features/softclipBases/mark.ts'
import { isWithinReadBand } from '../../shared/hitTestTypes.ts'
import { readIdAt } from '../../shared/readIdentity.ts'
import { interbaseTypeName } from '../../shared/types.ts'
import { canvasToGenomicCoords } from './alignmentComponentUtils.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { CoverageHitResult } from '../../features/coverage/types.ts'
import type { IndicatorHitResult } from '../../features/indicator/types.ts'
import type { ModificationHitResult } from '../../features/modification/hitTest.ts'
import type { ChevronFrame } from '../../features/read/mark.ts'
import type {
  CigarCoords,
  CigarHitResult,
  ResolvedBlock,
} from '../../shared/hitTestTypes.ts'
import type { PileupMark } from '../renderers/pileupMarks.ts'
import type { RenderState } from '../renderers/rendererTypes.ts'
import type { ArcMarkHit } from './arcHitTest.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

export type HitTestResult =
  | { type: 'indicator'; hit: IndicatorHitResult; resolved: ResolvedBlock }
  | { type: 'coverage'; hit: CoverageHitResult; resolved: ResolvedBlock }
  | {
      type: 'cigar'
      hit: CigarHitResult
      featureHit?: { id: string; index: number }
      resolved: ResolvedBlock
    }
  | {
      type: 'modification'
      hit: ModificationHitResult
      featureHit?: { id: string; index: number }
      cigarHit?: CigarHitResult
      resolved: ResolvedBlock
    }
  | {
      type: 'feature'
      hit: { id: string; index: number }
      resolved: ResolvedBlock
    }
  | { type: 'none' }

// What a GESTURE resolves to: the pileup's answer, or the arc band's, which
// outranks it (see `ArcMarkHit`). `performHitTest` never returns the arc
// variant — arcs are a different feed and deliberately not in this pipeline —
// but every consumer of a gesture's result switches over both, which is what
// makes declining to act through an arc a thing the compiler asks for.
export type MarkHitResult = HitTestResult | ArcMarkHit

// Above ~50kbp visible region (2000px / 50000bp = 25), per-base detail is
// too zoomed out to be meaningful.
export const SNP_HIT_MAX_BP_PER_PX = 25

/**
 * What the cursor was over when the right-click landed, as ONE value.
 *
 * These fields always travel together — the hit test resolves them at once, the
 * model stores them at once, and every menu builder reads them at once — so
 * they are a single volatile rather than five. That makes two things
 * structural that used to be comments: a consumer cannot read a block without
 * its hit (the split-state class of bug that silently no-op'd position sorts),
 * and closing the menu cannot forget a field.
 *
 * `contextMenuFeature`/`contextMenuFeatureId` deliberately stay OUTSIDE it. The
 * read arrives an RPC after the hit, so those two genuinely change on their own
 * — and they are the surface `addDisplayMenuItems` extension points read by
 * name (LinearReadVsRef, DotplotReadVsRef, and core's own doc example), which
 * is a contract this file does not get to reshape.
 */
export interface ContextMenuHit {
  // The block the right-click landed in (refName + worker result + bp range):
  // the source of every item's refName, and of the aggregate widgets' rpcData.
  // Required — the pipeline only reports a hit inside a resolved block, so a
  // menu built without one was never a real state.
  block: ResolvedBlock
  // The genomic COLUMN under the cursor, whatever mark answered. The read
  // menu's position sorts and the cigar submenu's base-pair sort both anchor
  // here rather than on a mark's own start — see getHitMenuItems.
  genomicPos: number
  cigarHit?: CigarHitResult
  indicatorHit?: IndicatorHitResult
  modHit?: ModificationHitResult
  coverageHit?: CoverageHitResult
}

export interface ContextMenuTarget {
  hit: ContextMenuHit
  // The read under the cursor, when the hit resolved one.
  featureId?: string
}

// What a right-click resolves to, or undefined for a mark with nothing to
// offer — which falls through to the BROWSER's menu rather than opening an
// empty one. An arc is the only such mark: its feed is junctions, so there is
// no read to act on and no bin to open.
//
// A cigar/modification hit carries the read's featureId so the read's own items
// (view mate, feature details) stay reachable over a mismatched or modified
// base, not just over bare body. A modification hit also carries the underlying
// cigarHit (its mismatch, when the modified base is also a SNP), so the SNP
// submenu appears beside the mod item.
export function contextMenuTargetForHit(
  result: MarkHitResult,
  canvasX: number,
): ContextMenuTarget | undefined {
  if (result.type === 'none' || result.type === 'arc') {
    return undefined
  }
  const block = result.resolved
  const base = { block, genomicPos: canvasXToBasePos(canvasX, block) }
  switch (result.type) {
    case 'cigar':
      return {
        hit: { ...base, cigarHit: result.hit },
        featureId: result.featureHit?.id,
      }
    case 'modification':
      return {
        hit: { ...base, cigarHit: result.cigarHit, modHit: result.hit },
        featureId: result.featureHit?.id,
      }
    case 'indicator':
      return { hit: { ...base, indicatorHit: result.hit } }
    case 'coverage':
      return { hit: { ...base, coverageHit: result.hit } }
    case 'feature':
      return { hit: base, featureId: result.hit.id }
  }
}

// The chain's representative read, for a hover that lands on a chain's ROW but
// on none of its reads — i.e. over the connecting line spanning the gap between
// mates. `chainFlatbush` boxes each chain's whole minStart..maxEnd extent, so it
// answers "which chain owns this row here" where `hitTestFeature` (exact read
// extents) finds nothing. Only reached as a fallback: over an actual read the
// caller must return that read, not the chain's first one, or the tooltip /
// details / context menu would describe mate 1 while the cursor is on mate 2.
function hitTestChain(
  coords: CigarCoords,
  rpcData: PileupDataResult,
  featureHeight: number,
) {
  if (!rpcData.chainFlatbush || !rpcData.chainFirstReadIndices) {
    return undefined
  }
  const { genomicPos, row } = coords
  if (!isWithinReadBand(coords, featureHeight)) {
    return undefined
  }
  const hits = rpcData.chainFlatbush.search(genomicPos, row, genomicPos, row)
  if (hits.length === 0) {
    return undefined
  }
  // Highest chain index wins, which is `hitTestFeature`'s tie-break (last drawn
  // is the one under the cursor) rather than the distance rule the other
  // index-backed test uses: these boxes all CONTAIN the point, so every
  // candidate is at distance 0 and picking by distance is undefined.
  // `buildChainConnectingData` adds to the Flatbush and emits the connecting
  // lines in one ascending pass over chain index, so a higher index is a later
  // line.
  //
  // Ambiguity is only reachable on the `placeRectCapped` overflow row, where
  // every truncated chain is piled onto the `maxRows` sentinel and their spans
  // freely overlap; a real row holds non-overlapping chain extents by
  // construction, so a point query there returns one box and any rule agrees.
  // That row sits immediately below the last drawn one (truncation implies
  // `maxY === maxRows`) and an ungrouped display hit-tests the whole canvas
  // against its single section — `findSectionAtY` short-circuits with no bottom
  // bound — so a track taller than its capped pileup can put the cursor there.
  let best = hits[0]!
  for (let i = 1; i < hits.length; i++) {
    if (hits[i]! > best) {
      best = hits[i]!
    }
  }
  const readIdx = rpcData.chainFirstReadIndices[best]!
  return { id: readIdAt(rpcData, readIdx)!, index: readIdx }
}

export interface HitTestOptions {
  /**
   * The hovered section's render state — the display's, with the section's
   * own `pileupTopOffset` and `coverageTopOffset` in place. The marks read
   * their gates and their geometry off it, which is what makes the draw gate
   * and the hit gate one: a mark `enabled` says no to answers no hover.
   */
  state: RenderState
  // The hovered section's coverage band — 0 when the band is off, which is the
  // whole gate: the coverage and interbase tests answer nothing in a 0px band.
  coverageHeight: number
  // Autoscaled coverage domain max (global across groups), needed to reproduce
  // the interbase histogram bar heights for hit-testing. Undefined until the
  // debounced autoscale resolves.
  coverageMaxDepth: number | undefined
  // False when this section's pileup band is collapsed to zero height
  // (`showPileup` off, or a collapsed group): reads are laid out but not drawn,
  // so the per-read/cigar/modification tests must be skipped to avoid resolving
  // a hover over the empty band. Coverage/indicator tests still run.
  pileupVisible: boolean
}

// What a pileup mark's `hitNearest` is asked over: the block as a `RenderBlock`,
// which is the bounds `bpAtPx` reads and nothing else of it.
function markBlock(resolved: ResolvedBlock): RenderBlock {
  return { displayedRegionIndex: 0, ...boundsOf(resolved) }
}

// The instance of `mark` under the cursor among `candidates`, or undefined.
// `Infinity` because a pileup shape's rule is containment (a span, a cell, a
// point's declared tolerance) and it answers nothing outside it; the distance
// it reports is to the ink, which is how a centerline hits across its row.
function markHit(
  mark: PileupMark,
  resolved: ResolvedBlock,
  state: RenderState,
  xPx: number,
  yPx: number,
  candidates: Iterable<number>,
) {
  return mark.hitNearest!(
    resolved.rpcData,
    markBlock(resolved),
    state,
    xPx,
    yPx,
    candidates,
    Infinity,
  )?.index
}

// A deletion/skip under the cursor, dropped when it is narrower than
// `minLength`. Zoomed in that is 0 — every gap the cursor is over counts —
// and zoomed out it is `bpPerPx`, i.e. keep only what still spans a pixel.
//
// That length rule applies to both gap kinds and is about resolvability alone.
// The frequency gate is the marks' own significance question, and it reaches
// only deletions — `gap/mark.ts` says why.
//
// One scan per mark, and the LARGER index wins: both marks read one array in
// one order, so a later entry is the one painted on top — the topmost rule,
// applied across the two marks as well as within each. `DELETION_MARK` answers
// nothing while its layer is off (`enabled`), so an undrawn deletion neither
// intercepts the whole span of a read that paints solid across it nor masks a
// skip beneath it on the same row.
function hitTestSignificantGap(
  resolved: ResolvedBlock,
  state: RenderState,
  xPx: number,
  yPx: number,
  minLength: number,
) {
  const data = resolved.rpcData
  const all = () => backToFront(0, data.gapYs.length)
  const skip = markHit(SKIP_MARK, resolved, state, xPx, yPx, all())
  const deletion = markHit(DELETION_MARK, resolved, state, xPx, yPx, all())
  const i =
    skip === undefined
      ? deletion
      : deletion === undefined
        ? skip
        : Math.max(skip, deletion)
  const gap = i === undefined ? undefined : gapHit(data, i)
  return gap && gap.length >= minLength ? gap : undefined
}

// Priority chain across CIGAR features, top-down:
//  1. large insertions (wide boxes that overlap SNPs)
//  2. mismatches (1bp features under the cursor base)
//  3. small insertions (thin bars that don't overlap SNPs)
//  4. gaps (deletions/skips spanning the read body)
//  5. clips (interbase bars at alignment edges; softclip wins over hardclip)
//
// Each step asks a pileup mark, and the mark's `enabled` is the gate: steps
// 1-3 and the deletion half of 4 vanish with `showMismatches` because their
// marks do, and the skip centerlines and clips stay because theirs are
// unconditional. Callers have already checked `isWithinReadBand`.
//
// Above `SNP_HIT_MAX_BP_PER_PX` the per-base steps drop out — a mismatch or a
// thin insertion is narrower than the cursor by then — leaving the marks that
// still read at that zoom: a large insertion, and a deletion at least a pixel
// wide. Clips stay in at EVERY zoom, because their mark draws at every zoom: a
// fixed 1px bar whatever `bpPerPx` is. What thins them instead is the mark's
// own frequency gate, which drops a clip the worker zeroed rather than one the
// shader merely faded.
//
// The whole chain lives here for that last reason. The zoomed-out steps used to
// be spelled a second time at the call site, and clips were simply absent from
// the copy — so above 25 bp/px an opaque clip bar answered nothing.
function hitTestCigarItem(
  resolved: ResolvedBlock,
  state: RenderState,
  xPx: number,
  yPx: number,
  bpPerPx: number,
): CigarHitResult | undefined {
  const data = resolved.rpcData
  const perBase = bpPerPx <= SNP_HIT_MAX_BP_PER_PX
  const pxPerBp = 1 / bpPerPx
  const at = (mark: PileupMark, candidates: Iterable<number>) =>
    markHit(mark, resolved, state, xPx, yPx, candidates)
  const large = at(INSERTION_MARK, insertionsOfSize(data, 'large', pxPerBp))
  if (large !== undefined) {
    return insertionHit(data, large)
  }
  if (perBase) {
    const mismatch = at(MISMATCH_MARK, backToFront(0, data.mismatchYs.length))
    if (mismatch !== undefined) {
      return mismatchHit(data, mismatch)
    }
    const small = at(INSERTION_MARK, insertionsOfSize(data, 'small', pxPerBp))
    if (small !== undefined) {
      return insertionHit(data, small)
    }
  }
  const gap = hitTestSignificantGap(
    resolved,
    state,
    xPx,
    yPx,
    perBase ? 0 : bpPerPx,
  )
  if (gap) {
    return gap
  }
  const clip =
    at(CLIP_MARK, clipsOfKind(data, 'soft')) ??
    at(CLIP_MARK, clipsOfKind(data, 'hard'))
  return clip === undefined ? undefined : clipHit(data, clip)
}

// The read behind a drawn soft-clip base cell.
//
// `readPositions` carries the read's TRUE aligned extent — the soft-clip
// expansion is applied to the layout's extents only, never written back — so
// `hitTestFeature` finds nothing over the clipped tail even though the
// softclip-bases mark paints a full-height cell per clipped base there. Without
// this the visible clipped run answered no hover, cleared the selection on
// click, and fell through to the browser's own context menu on right-click.
//
// Answers the READ, like `hitTestFeature`: the cells are that read's unaligned
// tail, so the tooltip/details/menu should describe it. The clip itself is
// already reachable — the clip mark covers the bar at the alignment edge, and
// the cigar chain runs first.
function hitTestSoftclipBase(
  resolved: ResolvedBlock,
  state: RenderState,
  xPx: number,
  yPx: number,
): { id: string; index: number } | undefined {
  const data = resolved.rpcData
  const i = markHit(
    SOFTCLIP_BASES_MARK,
    resolved,
    state,
    xPx,
    yPx,
    backToFront(0, data.softclipBaseYs.length),
  )
  const readIdx = i === undefined ? undefined : data.softclipBaseReadIndices[i]!
  const id = readIdx === undefined ? undefined : readIdAt(data, readIdx)
  return id === undefined || readIdx === undefined
    ? undefined
    : { id, index: readIdx }
}

function boundsOf(resolved: ResolvedBlock) {
  return {
    start: resolved.bpRange[0],
    end: resolved.bpRange[1],
    screenStartPx: resolved.blockStartPx,
    screenEndPx: resolved.blockStartPx + resolved.blockWidth,
    reversed: resolved.reversed,
  }
}

// The FRACTIONAL position along the block under canvasX — what the
// distance-based hit tests want (interbase triangles, modification centers,
// insertion markers, read containment), since they measure against a bp
// coordinate rather than indexing a base. `bpAtPxExact` owns the reversed
// pivot.
export function canvasXToGenomicPos(canvasX: number, resolved: ResolvedBlock) {
  return bpAtPxExact(canvasX, boundsOf(resolved))
}

// The INTEGER base under canvasX — what anything indexing a base wants (a
// mismatch column, a coverage bin, the sort-at-this-column anchor).
//
// Not `Math.floor(canvasXToGenomicPos(...))`: on a reversed block bp runs
// leftward, so the fractional position lands in `(b, b+1]` and flooring names
// `b+1` on base b's leftmost pixel column. bpAtPx owns that pivot — it is the
// inverse of the makeCellLeftMapper the per-base painters use.
export function canvasXToBasePos(canvasX: number, resolved: ResolvedBlock) {
  return bpAtPx(canvasX, boundsOf(resolved))
}

// Runs the priority chain for a cursor known to be over a fetched block. The
// caller resolves the block first and answers `{type:'none'}` itself when there
// isn't one, so nothing here has to re-ask whether `resolved` exists.
export function performHitTest(
  canvasX: number,
  canvasY: number,
  resolved: ResolvedBlock,
  options: HitTestOptions,
): HitTestResult {
  const { state, coverageHeight, coverageMaxDepth, pileupVisible } = options
  const {
    showInterbaseIndicators,
    coverageSnpMinFrequency,
    coverageTopOffset,
    featureHeight,
    featureSpacing,
    scrollTop,
    chainMode,
    colorScheme,
  } = state

  // Coverage/indicator strip tests are relative to this section's coverage top
  // (0 = the ungrouped sticky band at the canvas top).
  const coverageY = canvasY - coverageTopOffset

  const bpSpan = resolved.bpRange[1] - resolved.bpRange[0]
  const bpPerPx = bpSpan / resolved.blockWidth
  const genomicPos = canvasXToGenomicPos(canvasX, resolved)
  const basePos = canvasXToBasePos(canvasX, resolved)

  // The band's own marks first — an interbase bar or indicator triangle
  // outranks the depth bin under it — then the bin, which zoomed out snaps to
  // the pixel's dominant SNP. Both work at every zoom.
  const bandHit = hitCoverageBand(
    resolved.rpcData,
    {
      height: coverageHeight,
      top: coverageTopOffset,
      domainMax: coverageMaxDepth,
      showInterbase: showInterbaseIndicators,
    },
    boundsOf(resolved),
    canvasX,
    canvasY,
  )
  if (bandHit) {
    return {
      type: 'indicator',
      hit: {
        type: 'indicator',
        position: bandHit.position,
        indicatorType: interbaseTypeName(bandHit.type),
      },
      resolved,
    }
  }

  // `coverageHeight` is the band's reserved height: 0 when the band is off,
  // so an off band answers nothing without a flag to consult beside it.
  if (coverageHeight > 0 && coverageY >= 0 && coverageY <= coverageHeight) {
    const position = coverageBinAt(
      resolved.rpcData,
      basePos,
      bpPerPx,
      resolved.reversed,
      coverageSnpMinFrequency,
    )
    if (position !== undefined) {
      return { type: 'coverage', hit: { type: 'coverage', position }, resolved }
    }
  }

  // A collapsed pileup band (showPileup off / collapsed group) lays reads out
  // but never paints them, so don't resolve hovers over the empty band.
  if (!pileupVisible) {
    return { type: 'none' }
  }

  const coords = canvasToGenomicCoords({
    canvasY,
    genomicPos,
    basePos,
    bpPerPx,
    featureHeight,
    featureSpacing,
    topOffset: state.pileupTopOffset,
    scrollTop,
  })

  // Every per-read test below is confined to a drawn read body. Asked once
  // here for the two branches that used to spell it separately; the tests that
  // are exported and unit-tested on their own — hitTestFeature,
  // hitTestModification — keep their own guard, and the marks reject the
  // inter-row gap themselves.
  const chevrons: ChevronFrame = {
    pxPerBp: 1 / bpPerPx,
    chainMode,
    colorScheme,
    featureHeight,
  }
  const inReadBand = isWithinReadBand(coords, featureHeight)

  if (inReadBand) {
    // Modification before CIGAR: a modified+mismatched base resolves as a
    // modification hit, not a mismatch hit. Per-base like the mismatch step, so
    // it drops out at the same zoom; `modFlatbush` is undefined outside
    // modification mode, which makes this a no-op there.
    const modificationHit =
      bpPerPx <= SNP_HIT_MAX_BP_PER_PX
        ? hitTestModification(resolved, coords, featureHeight)
        : undefined
    // `hitTestCigarItem` owns the zoom regime, so this reads the same at every
    // zoom. `featureHit` rides along throughout: without it a right-click on a
    // zoomed-out insertion/deletion loses the read's own menu items and a hover
    // drops the chain highlight, purely because of zoom.
    const cigarHit = hitTestCigarItem(
      resolved,
      state,
      canvasX,
      canvasY,
      bpPerPx,
    )
    if (modificationHit) {
      return {
        type: 'modification',
        hit: modificationHit,
        featureHit: hitTestFeature(resolved, coords, chevrons),
        cigarHit,
        resolved,
      }
    }
    if (cigarHit) {
      return {
        type: 'cigar',
        hit: cigarHit,
        featureHit: hitTestFeature(resolved, coords, chevrons),
        resolved,
      }
    }
  }

  // The read under the cursor always wins. A miss then falls back to the read's
  // soft-clipped tail (drawn past its aligned extent, so `hitTestFeature` can't
  // see it) and, in chain mode, to the chain — so the connecting line between
  // mates stays hoverable. `readIdsSharingChain` resolves the whole chain from any
  // of its reads, so the chain highlight/selection is unaffected by which read
  // answers.
  const hit =
    hitTestFeature(resolved, coords, chevrons) ??
    hitTestSoftclipBase(resolved, state, canvasX, canvasY) ??
    (chainMode
      ? hitTestChain(coords, resolved.rpcData, featureHeight)
      : undefined)
  return hit ? { type: 'feature', hit, resolved } : { type: 'none' }
}
