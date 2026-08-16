import { bpAtPx } from '@jbrowse/render-core/canvas2dUtils'

import { hitTestClip } from '../../features/clip/hitTest.ts'
import { hitTestCoverage } from '../../features/coverage/hitTest.ts'
import { hitTestGap } from '../../features/gap/hitTest.ts'
import { hitTestInterbase } from '../../features/indicator/hitTest.ts'
import {
  hitTestLargeInsertion,
  hitTestSmallInsertion,
} from '../../features/insertion/hitTest.ts'
import { hitTestMismatch } from '../../features/mismatch/hitTest.ts'
import { hitTestModification } from '../../features/modification/hitTest.ts'
import { hitTestFeature } from '../../features/read/hitTest.ts'
import { hitTestSoftclipBase } from '../../features/softclipBases/hitTest.ts'
import { isWithinReadBand } from '../../shared/hitTestTypes.ts'
import { readIdAt } from '../../shared/readIdentity.ts'
import { canvasToGenomicCoords } from './alignmentComponentUtils.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { CoverageHitResult } from '../../features/coverage/types.ts'
import type { IndicatorHitResult } from '../../features/indicator/types.ts'
import type { ModificationHitResult } from '../../features/modification/hitTest.ts'
import type {
  CigarCoords,
  CigarHitResult,
  ResolvedBlock,
} from '../../shared/hitTestTypes.ts'
import type { ArcMarkHit } from './arcHitTest.ts'

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
  showCoverage: boolean
  showInterbaseIndicators: boolean
  coverageHeight: number
  // Autoscaled coverage domain max (global across groups), needed to reproduce
  // the interbase histogram bar heights for hit-testing. Undefined until the
  // debounced autoscale resolves.
  coverageMaxDepth: number | undefined
  topOffset: number
  // Screen-px Y of this section's coverage band top. 0 for the ungrouped
  // sticky-at-top coverage; a stacked group's scrolled coverage top otherwise.
  // Subtracted from canvasY so the coverage/indicator strip tests are
  // section-local.
  coverageTopOffset: number
  featureHeight: number
  featureSpacing: number
  scrollTop: number
  isChainMode: boolean
  // Mirrors the draw-time alpha gate: when true, low-frequency mismatches fade
  // (and stop being clickable) once zoomed out; when false they draw opaque and
  // stay clickable at every zoom.
  filterMismatchesByFrequency: boolean
  // Mirrors the `deletion` / `mismatch` / `insertion` draw layers, which are
  // the three PILEUP_LAYERS entries gated on this flag. The arrays are fetched
  // either way (it is a repaint-tier setting, not an `rpcProps` one), so
  // without this the marks stayed hoverable, clickable and right-clickable
  // while nothing was drawn for them — and `hitTestGap` went on intercepting
  // the whole deletion span, making a read that draws as solid body
  // unselectable across it. Two layers are deliberately absent: `clip` and
  // `skip` both draw unconditionally, so their hit tests must too.
  showMismatches: boolean
  // False when this section's pileup band is collapsed to zero height
  // (`showPileup` off, or a collapsed group): reads are laid out but not drawn,
  // so the per-read/cigar/modification tests must be skipped to avoid resolving
  // a hover over the empty band. Coverage/indicator tests still run.
  pileupVisible: boolean
}

// A deletion/skip under the cursor, dropped when it is narrower than
// `minLength`. Zoomed in that is 0 — every gap the cursor is over counts —
// and zoomed out it is `bpPerPx`, i.e. keep only what still spans a pixel.
function hitTestSignificantGap(
  resolved: ResolvedBlock,
  coords: CigarCoords,
  minLength: number,
  includeDeletions: boolean,
) {
  const gap = hitTestGap(resolved, coords, includeDeletions)
  return gap && gap.length >= minLength ? gap : undefined
}

// Priority chain across CIGAR features, top-down:
//  1. large insertions (wide boxes that overlap SNPs)
//  2. mismatches (1bp features under the cursor base)
//  3. small insertions (thin bars that don't overlap SNPs)
//  4. gaps (deletions/skips spanning the read body)
//  5. clips (interbase bars at alignment edges; softclip wins over hardclip)
//
// Steps 1-3 are `showMismatches` layers and vanish with them; step 5 draws
// unconditionally and so stays. Step 4 is half of each, because its two marks
// are now two layers: `showMismatches` off leaves the intron centerlines drawn
// and hittable while the deletion bars go, so the gap test still runs and
// `hitTestGap` is told which kinds it may answer with. Callers have already
// checked `isWithinReadBand`.
//
// Above `SNP_HIT_MAX_BP_PER_PX` the per-base steps drop out — a mismatch or a
// thin insertion is narrower than the cursor by then — leaving the marks that
// still read at that zoom: a large insertion, and a deletion at least a pixel
// wide. Clips stay in at EVERY zoom, because their layer draws at every zoom:
// `drawClipBars` paints a fixed 1px bar whatever `bpPerPx` is. What thins them
// instead is `hitTestClip`'s own `passesFrequencyGate` — the significance gate
// every other mark test applies, which drops a clip the worker zeroed rather
// than one the shader merely faded.
//
// The whole chain lives here for that last reason. The zoomed-out steps used to
// be spelled a second time at the call site, and clips were simply absent from
// the copy — so above 25 bp/px an opaque clip bar answered nothing, and a hover
// fell through to the read body. `HIT_GATES` files `clip` as `alwaysDrawn`,
// whose contract is that the hit test is ungated too; the parity test could not
// catch the drift because it varies settings, never zoom.
function hitTestCigarItem(
  resolved: ResolvedBlock,
  coords: CigarCoords,
  featureHeight: number,
  bpPerPx: number,
  { filterMismatchesByFrequency, showMismatches }: HitTestOptions,
): CigarHitResult | undefined {
  const perBase = bpPerPx <= SNP_HIT_MAX_BP_PER_PX
  const mismatchMarks = showMismatches
    ? (hitTestLargeInsertion(resolved, coords, featureHeight) ??
      (perBase
        ? (hitTestMismatch(resolved, coords, filterMismatchesByFrequency) ??
          hitTestSmallInsertion(
            resolved,
            coords,
            featureHeight,
            filterMismatchesByFrequency,
          ))
        : undefined))
    : undefined
  return (
    mismatchMarks ??
    hitTestSignificantGap(
      resolved,
      coords,
      perBase ? 0 : bpPerPx,
      showMismatches,
    ) ??
    hitTestClip(resolved, coords, filterMismatchesByFrequency)
  )
}

// Single site for the canvas-X → genomicPos transform; `reversed` is handled
// here and nowhere else. The result is FRACTIONAL — a position along the block,
// not a base. That's what the distance-based hit tests want (interbase
// triangles, modification centers, insertion markers, read containment), since
// they measure against a bp coordinate rather than indexing a base.
export function canvasXToGenomicPos(canvasX: number, resolved: ResolvedBlock) {
  const bpSpan = resolved.bpRange[1] - resolved.bpRange[0]
  const frac = (canvasX - resolved.blockStartPx) / resolved.blockWidth
  return resolved.reversed
    ? resolved.bpRange[1] - frac * bpSpan
    : resolved.bpRange[0] + frac * bpSpan
}

// The INTEGER base under canvasX — what anything indexing a base wants (a
// mismatch column, a coverage bin, the sort-at-this-column anchor).
//
// Not `Math.floor(canvasXToGenomicPos(...))`: on a reversed block bp runs
// leftward, so the fractional position lands in `(b, b+1]` and flooring names
// `b+1` on base b's leftmost pixel column. bpAtPx owns that pivot — it is the
// inverse of the makeCellLeftMapper the per-base painters use.
export function canvasXToBasePos(canvasX: number, resolved: ResolvedBlock) {
  return bpAtPx(canvasX, {
    start: resolved.bpRange[0],
    end: resolved.bpRange[1],
    screenStartPx: resolved.blockStartPx,
    screenEndPx: resolved.blockStartPx + resolved.blockWidth,
    reversed: resolved.reversed,
  })
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
  const {
    showCoverage,
    showInterbaseIndicators,
    coverageHeight,
    coverageMaxDepth,
    topOffset,
    coverageTopOffset,
    featureHeight,
    featureSpacing,
    scrollTop,
    isChainMode,
    pileupVisible,
  } = options

  // Coverage/indicator strip tests are relative to this section's coverage top
  // (0 = the ungrouped sticky band at the canvas top).
  const coverageY = canvasY - coverageTopOffset

  const bpSpan = resolved.bpRange[1] - resolved.bpRange[0]
  const bpPerPx = bpSpan / resolved.blockWidth
  const genomicPos = canvasXToGenomicPos(canvasX, resolved)
  const basePos = canvasXToBasePos(canvasX, resolved)

  // Indicator and coverage tooltips work at all zoom levels.
  // hitTestInterbase fires over the interbase histogram bars + indicator
  // triangles, taking priority over coverage so hovering a bar shows interbase.
  // hitTestCoverage handles zoomed-out bins: returns the bin position and snaps
  // to any significant SNP within the bin when bpPerPx > 1.
  const indicatorHit = hitTestInterbase(
    genomicPos,
    bpPerPx,
    coverageY,
    resolved.rpcData,
    showCoverage,
    showInterbaseIndicators,
    coverageHeight,
    coverageMaxDepth,
  )
  if (indicatorHit) {
    return { type: 'indicator', hit: indicatorHit, resolved }
  }

  const coverageHit = hitTestCoverage(
    basePos,
    bpPerPx,
    coverageY,
    resolved.rpcData,
    showCoverage,
    coverageHeight,
    resolved.reversed,
  )
  if (coverageHit) {
    return { type: 'coverage', hit: coverageHit, resolved }
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
    topOffset,
    scrollTop,
  })

  // Every per-read test below is confined to a drawn read body. Asked once
  // here for the two branches that used to spell it separately (hitTestCigarItem
  // internally, the zoomed-out branch inline); the tests that are exported and
  // unit-tested on their own — hitTestFeature, hitTestModification,
  // hitTestSoftclipBase — keep their own guard.
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
      coords,
      featureHeight,
      bpPerPx,
      options,
    )
    if (modificationHit) {
      return {
        type: 'modification',
        hit: modificationHit,
        featureHit: hitTestFeature(resolved, coords, featureHeight),
        cigarHit,
        resolved,
      }
    }
    if (cigarHit) {
      return {
        type: 'cigar',
        hit: cigarHit,
        featureHit: hitTestFeature(resolved, coords, featureHeight),
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
    hitTestFeature(resolved, coords, featureHeight) ??
    hitTestSoftclipBase(resolved, coords, featureHeight) ??
    (isChainMode
      ? hitTestChain(coords, resolved.rpcData, featureHeight)
      : undefined)
  return hit ? { type: 'feature', hit, resolved } : { type: 'none' }
}
