import { PAIR_DIRECTION_NUM, splitJunctionKind } from '@jbrowse/alignments-core'

import { ARC_SLOT_CATEGORY } from '../../shaders/palettes.ts'
import { pairCategory } from '../../shared/pairCategory.ts'

import type { InsertSizeBand } from '../../shared/insertSizeStats.ts'
import type { ArcColorField } from '../../shared/types.ts'
import type { ComputedArc, PendingArc } from './arcTypes.ts'

// Which colour slot an arc paints in, and the paint order that follows from it.
// Split from `compute.ts`: classification is a pure function of a connection's
// own fields, so it has no share in the chain building, clustering or region
// partitioning the rest of the pass does.

// A pair is concordant FR (the modal, "normal" insert) when its tlen sits
// inside the insert-size stats band AND it is LR orientation. Read cloud drops
// these to surface SV signals (mirrors samplot.py's --max_depth 1 default).
//
// TLEN 0 — SAM's "information unavailable" encoding — is never concordant, the
// same guard `classifyInsertSize` applies for the same reason. `stats.lower` is
// `max(0, center - spread)`, so a noisy library floors it at 0 and an unset TLEN
// then satisfies `0 >= lower`: the pair reads as textbook-concordant on no
// evidence at all and is dropped. That made the cloud's contents depend on
// whether the fetched set's MAD happened to reach zero, and it discarded exactly
// the records `computeArcShape` re-plots at their breakpoint gap for being
// untrustworthy here.
export function isConcordantFRPair(
  pairOrientationNum: number | undefined,
  tlen: number | undefined,
  stats: InsertSizeBand | undefined,
) {
  if (
    pairOrientationNum !== PAIR_DIRECTION_NUM.LR ||
    tlen === undefined ||
    stats === undefined
  ) {
    return false
  }
  const abs = Math.abs(tlen)
  return abs > 0 && abs >= stats.lower && abs <= stats.upper
}

// Color-slot indices into the arc palette (`ARC_SLOT_CATEGORY`).
export const COLOR_DEFAULT = 0
export const COLOR_LONG_INSERT = ARC_SLOT_CATEGORY.indexOf('longInsert')
export const ARC_COLOR_SHORT_INSERT = ARC_SLOT_CATEGORY.indexOf('shortInsert')
// The only colour an interchromosomal arc or tick takes: insert size and
// pair orientation mean nothing across two references.
export const ARC_COLOR_INTERCHROM = 3
// A split-read junction, by which way the read extends from its two feet —
// see `arcSplitCategory.ts`. Each takes the colour of the pair class that spans
// the same junction.
export const COLOR_SPLIT_FORWARD = 7
export const COLOR_SPLIT_BACK = 8
export const COLOR_SPLIT_INV_LL = 9
export const COLOR_SPLIT_INV_RR = 10

// Paint rank of an arc color slot: 0 for the baseline "nothing to see here"
// slot, 1 for every slot that says something. Array order is paint order and
// the strokes are opaque, so this is the coarsest key of `resolveArcs`' sort —
// every categorized arc lands over every uncategorized one.
//
// A deep short-read pileup is overwhelmingly concordant pairs, and they all
// paint COLOR_DEFAULT. On HG002 300x the ratio is about 50:1 even after the
// insert-size band was floored to the event scale, so the handful of arcs
// carrying a category were being punched through by grey arcs fetched later —
// support-ascending order is arbitrary with respect to whether an arc means
// anything. The signal is what the band is drawn for, and it has to survive the
// noise crossing it.
//
// Deliberately binary rather than a per-slot priority list: the distinction
// that matters is categorized vs not, and ranking the categories against each
// other would be asserting that a short insert outranks an inversion, which
// nothing here knows. Within a rank, `support` still orders them.
export function arcPaintRank(colorType: number) {
  return colorType === COLOR_DEFAULT ? 0 : 1
}

// CATEGORY FIRST, then ASCENDING SUPPORT, because array order is paint order and
// the strokes are opaque: the last arc drawn over a shared pixel is the one that
// keeps it. THE order for both halves of the feed — the per-region arrays here
// and the cross-region arcs.
//
// `arcPaintRank` is the coarse key — every arc that says something paints over
// every arc that does not; see it for why a deep pileup needs that. Support
// orders each rank internally: first-seen order is the reads' order, which is
// arbitrary with respect to support, so a singleton fetched late punched a gap
// through every heavier arc it crossed — and the hit test's last-drawn-wins
// tie-break then handed those pixels to it too. Heaviest-last is the ranking
// `arcStrokeScale` exists to express, and it is what lets the hit test resolve an
// overlap toward the strongest junction and still be describing the arc on top.
//
// TOTAL, tie-broken on the dedup key, because "the reads' order they arrived in"
// — which is what a merely stable sort leaves equal-support arcs in — is not the
// same order twice. Reads reach `pendingArcs` as their fetches complete, so on a
// loaded machine a different interleaving produces a different paint order among
// equal-support arcs, and paint order is what decides the color of every pixel
// where two of them cross.
//
// It surfaced as an intermittently failing image snapshot: AlignmentArcs'
// out-of-view-pairing frame came back 4.9% different, with the whole difference
// inside the arc band and the reads and coverage below it pixel-identical — the
// data was the same, only the order it was painted in had changed. `key` is what
// arcs are deduped by, so no two share it and this is a strict weak ordering;
// which arc wins a tie does not matter, only that the same one wins it every
// time.
export function arcPaintOrder(a: ComputedArc, b: ComputedArc) {
  return (
    arcPaintRank(a.colorType) - arcPaintRank(b.colorType) ||
    a.support - b.support ||
    (a.key < b.key ? -1 : 1)
  )
}

// A junction's class from the direction the read extends at its lower and its
// higher foot. Same-strand segments always extend opposite ways and
// opposite-strand segments the same way, so every junction with both strands
// known lands in one of the four; an unknown strand keeps the default slot.
//
// Two feet on one base (a split insertion) have no lower foot, and ordering
// them by arrival made a forward read "forward" and a reverse read over the
// same junction "back" — two arcs, each with half the support. The left-
// extending foot is the lower one there.
function splitJunctionColor(arc: PendingArc) {
  const kind = splitJunctionKind(arc.p1Strand, arc.p2Strand)
  if (kind === undefined) {
    return COLOR_DEFAULT
  }
  const p1IsLower =
    arc.p1Bp === arc.p2Bp ? arc.p1Dir === -1 : arc.p1Bp < arc.p2Bp
  const lowerDir = p1IsLower ? arc.p1Dir : arc.p2Dir
  return kind === 'inversion'
    ? lowerDir === -1
      ? COLOR_SPLIT_INV_LL
      : COLOR_SPLIT_INV_RR
    : lowerDir === -1
      ? COLOR_SPLIT_FORWARD
      : COLOR_SPLIT_BACK
}

// The palette slot a pair category paints in. `pairLR` and `nonSplit` have no
// slot of their own and land on the baseline, which `arcSlotCategory` names
// per colouring mode.
const ARC_SLOT_OF_CATEGORY = new Map<string, number>(
  ARC_SLOT_CATEGORY.map((category, slot) => [category, slot]),
)

// Same-chromosome color classifier (interchromosomal ticks are colored
// separately, always COLOR_INTERCHROM). Read cloud shares this so its
// flat lines color the same as arcs — red/green/teal/navy by insert size +
// orientation.
// Exported for `arcReadColorParity.test.ts`, which holds this against
// `readColorCategory`.
export function getArcColorType(args: {
  arc: PendingArc
  colorField: ArcColorField
  hasPaired: boolean
}) {
  const { arc, colorField, hasPaired } = args

  // A split-read junction carries no pair semantics (no template length, no
  // pair orientation), so it colors by its own segment strands — opposite
  // strands flag the inversion — regardless of whether OTHER reads in the view
  // are paired. Keying on the per-connection `isSplit` instead of the dataset-
  // global `hasPaired` is what lets a paired read that is itself SA-split show
  // its inversion junctions correctly. Resolved before the insert class below
  // because that is a paired concept and a junction has no TLEN to classify.
  if (!hasPaired || arc.isSplit) {
    return colorField === 'insertSize' ? COLOR_DEFAULT : splitJunctionColor(arc)
  }
  // TLEN, and only TLEN, through the function `readColorCategory` classifies
  // with, so an arc and the reads under it cannot key the same pair two
  // different ways. This used to override the TLEN class with the pair's drawn
  // SPAN, which the read fills never had: `classifyInsertSize` sorts TLEN 0
  // into `normal`, so those arcs went red over reads that stayed grey, and the
  // span's outlier cut ran over the arcs IN VIEW, so an arc's colour changed
  // as you panned.
  return (
    ARC_SLOT_OF_CATEGORY.get(
      pairCategory(colorField, arc.pairOrientationNum, arc.tlen, arc.stats),
    ) ?? COLOR_DEFAULT
  )
}

/** A colour type's palette slot, the last slot for one past the palette. */
export function arcColorSlot(colorType: number) {
  return Math.min(colorType, ARC_SLOT_CATEGORY.length - 1)
}
