import { splitJunctionKind } from '@jbrowse/alignments-core'

import { ARC_SLOT_CATEGORY } from '../../shaders/palettes.ts'
// Generated constants, imported from the generated modules with no re-export
// hop through palettes.ts (SHADER_JS_CODEGEN.md).
import { ARC_COLOR_SHORT_INSERT } from '../../shaders/slang/arc.consts.generated.ts'
import { classifyInsertSize } from '../../shared/insertSizeStats.ts'

import type { ReadColorCategory } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import type { InsertSizeBand } from '../../shared/insertSizeStats.ts'
import type { ArcColorByType } from '../../shared/types.ts'
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
  if (pairOrientationNum !== 1 || tlen === undefined || stats === undefined) {
    return false
  }
  const abs = Math.abs(tlen)
  return abs > 0 && abs >= stats.lower && abs <= stats.upper
}

// Color-slot indices into the arc palette. Kept as named constants so the
// classifier reads as a story rather than as magic numbers.
export const COLOR_DEFAULT = 0
export const COLOR_LONG_INSERT = 1
// The shader's own slot number, rather than a local `2` agreeing with it by
// inspection. It is the slot two palettes used to disagree on — the endpoint
// squares carried a pale fill where the curves carried a saturated stroke —
// which is why it, alone of the nine, is a shared constant.
const COLOR_SHORT_INSERT = ARC_COLOR_SHORT_INSERT
// Interchrom has no local alias: arcLine.slang names ARC_COLOR_INTERCHROM
// directly now that a tick carries no per-instance color, and ARC_SLOT_CATEGORY
// is what puts the legend's interchrom swatch on the color the ticks paint.
// LL slot 4; RR slot 5; RL slot 6 (see arcColorPalette).
const COLOR_PAIR_LL = 4
const COLOR_PAIR_RR = 5
export const COLOR_PAIR_RL = 6
// Split-read inversion, EITHER strand-flip direction (rf/fr) → one magenta
// slot, matching the read-fill + connector split-inversion color.
export const COLOR_SPLIT_INVERSION = 7
// Same-strand (co-linear) split — a deletion / tandem-dup junction — → the
// supplementary yellow, matching the read-fill + connector deletion color.
export const COLOR_SPLIT_DELETION = 8

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
// and the cross-region overlay's SVG document order, where it also decides which
// arcs a cap keeps.
//
// `arcPaintRank` is the coarse key — every arc that says something paints over
// every arc that does not; see it for why a deep pileup needs that. Support
// orders each rank internally: first-seen order is the reads' order, which is
// arbitrary with respect to support, so a singleton fetched late punched a gap
// through every heavier arc it crossed — and `hitTestArcBand`'s last-drawn-wins
// tie-break then handed those pixels to it too. Heaviest-last is the ranking
// `arcLineWidth` exists to express, and it is what lets the hit test resolve an
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

// Legend category for an arc / read-cloud color slot. The read legend is
// otherwise driven purely by read-fill categories (readColorCategory), so
// cloud-only buckets — split junctions especially, which no read fill produces
// outside chain mode — would be missing; mapping the slots back to categories
// fills that gap.
//
// Reads ARC_SLOT_CATEGORY, the same table the arc palette resolves its colours
// through, so "each square's colour equals its category swatch" is now true by
// construction rather than by inspection. It used to be a second hand-written
// switch, which is how the two ended up describing different things.
export function arcColorLegendCategory(
  colorType: number,
  colorByType: ArcColorByType,
): ReadColorCategory {
  const category = ARC_SLOT_CATEGORY[colorType]
  // Slot 0 and anything out of range are the baseline colorPairLR; its LABEL is
  // the one thing that follows the coloring mode ('Normal' insert vs 'LR'
  // orientation), which is why this is not a bare table lookup. Every other slot
  // means the same thing whatever the mode.
  return category === undefined || category === 'normalInsert'
    ? colorByType === 'orientation'
      ? 'pairLR'
      : 'normalInsert'
    : category
}

// This path's encoding of the shared junction classifier: magenta inversion /
// yellow deletion, matching the split-read fill + connector colors; an
// unknown-strand junction falls back to the default slot.
export const SPLIT_KIND_COLOR = {
  inversion: COLOR_SPLIT_INVERSION,
  deletion: COLOR_SPLIT_DELETION,
}

function unpairedOrientationColor(p1Strand: number, p2Strand: number) {
  const kind = splitJunctionKind(p1Strand, p2Strand)
  return kind === undefined ? COLOR_DEFAULT : SPLIT_KIND_COLOR[kind]
}

// pairOrientationToNum (see shared/buildBaseFeatureData.ts) encodes:
//   0=unknown, 1=LR/normal (F1R2,F2R1), 2=RL (R1F2,R2F1),
//   3=RR (R1R2,R2R1), 4=LL (F1F2,F2F1).
// undefined means "normal/LR or unknown orientation" — the caller decides the
// fallback (plain default vs. defer to insert size).
function orientationColor(pairOrientationNum: number) {
  switch (pairOrientationNum) {
    case 2:
      return COLOR_PAIR_RL
    case 3:
      return COLOR_PAIR_RR
    case 4:
      return COLOR_PAIR_LL
    default:
      return undefined
  }
}

// Map the shared insert-size class onto this palette's arc color slots. The
// threshold rule (including the unset-TLEN guard) lives in classifyInsertSize,
// shared with the read-fill path (colorUtils.ts).
const insertClassArcColor = {
  long: COLOR_LONG_INSERT,
  short: COLOR_SHORT_INSERT,
  normal: COLOR_DEFAULT,
}

function insertSizeColor(tlen: number, stats: InsertSizeBand | undefined) {
  return insertClassArcColor[classifyInsertSize(Math.abs(tlen), stats)]
}

// Same-chromosome color classifier (interchromosomal ticks are colored
// separately, always COLOR_INTERCHROM). Read cloud shares this so its
// flat lines color the same as arcs — red/green/teal/navy by insert size +
// orientation.
// Exported for `arcReadColorParity.test.ts`, which holds this against
// `readColorCategory`. The claim that the two mirror each other is what
// `arcColorsMatchReads` folds the arc key into the read key on, and it was made
// in a comment rather than by a test until that fold was found asserting it
// where it does not hold.
export function getArcColorType(args: {
  arc: PendingArc
  colorByType: ArcColorByType
  hasPaired: boolean
  stats: InsertSizeBand | undefined
}) {
  const { arc, colorByType, hasPaired, stats } = args

  // A split-read junction carries no pair semantics (no template length, no
  // pair orientation), so it colors by its own segment strands — opposite
  // strands flag the inversion — regardless of whether OTHER reads in the view
  // are paired. Keying on the per-connection `isSplit` instead of the dataset-
  // global `hasPaired` is what lets a paired read that is itself SA-split show
  // its inversion junctions correctly. Resolved before the insert class below
  // because that is a paired concept and a junction has no TLEN to classify.
  if (!hasPaired || arc.isSplit) {
    return colorByType === 'insertSize'
      ? COLOR_DEFAULT
      : unpairedOrientationColor(arc.p1Strand, arc.p2Strand)
  }
  const orient = orientationColor(arc.pairOrientationNum)
  // TLEN, and only TLEN — the same field `readColorCategory` classifies, so an
  // arc and the reads under it cannot key the same pair two different ways.
  //
  // This used to override the TLEN class with the pair's drawn SPAN: a pair
  // whose mates sat more than LARGE_INSERT_THRESHOLD apart painted long-insert
  // whatever TLEN said, on the ground that a discordant pair often carries an
  // unreliable or 0 TLEN and the distance is the more trustworthy signal. The
  // signal is real, but the read fills never had the rule, so the two disagreed
  // on exactly the pairs it existed to catch: `classifyInsertSize` sorts TLEN 0
  // into `normal` (0 is neither > upper nor inside (0, lower)), so those arcs
  // went red over reads that stayed grey. That is what shipped in a figure.
  //
  // The span was also a moving target in a way TLEN is not: half of the test
  // was `absrad >= longRangeThreshold`, a median+MAD outlier cut over the arcs
  // IN VIEW, so an arc's color depended on what else was on screen and changed
  // as you panned.
  const insert = insertSizeColor(arc.tlen, stats)
  switch (colorByType) {
    case 'insertSize':
      return insert
    case 'orientation':
      return orient ?? COLOR_DEFAULT
    // Short-insert pairs always paint pink, even with abnormal orientation;
    // otherwise orientation wins, falling back to long-/normal-insert.
    case 'insertSizeAndOrientation':
      return insert === COLOR_SHORT_INSERT ? insert : (orient ?? insert)
  }
}
