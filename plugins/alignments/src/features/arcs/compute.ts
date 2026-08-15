import { splitJunctionKind } from '@jbrowse/alignments-core'
import {
  connectionEndpointBps,
  featurizeSA,
  readLeadingBp,
  readTrailingBodyDir,
  SAM_FLAG_MATE_REVERSE,
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_PAIRED,
} from '@jbrowse/cigar-utils'

import { ARC_SLOT_CATEGORY } from '../../shaders/palettes.ts'
// Generated constants, imported from the generated modules with no re-export
// hop through palettes.ts (SHADER_JS_CODEGEN.md).
import { ARC_COLOR_SHORT_INSERT } from '../../shaders/slang/arc.consts.generated.ts'
import { ARC_COLOR_INTERCHROM } from '../../shaders/slang/arcLine.consts.generated.ts'
import { isConcordantPairRead } from '../../shared/buildBaseFeatureData.ts'
import { classifyInsertSize } from '../../shared/insertSizeStats.ts'
import {
  clipAt,
  flagsOf,
  pairFieldEntry,
  resolveReadGroup,
  spanOf,
  strandOf,
} from '../../shared/readGroupConnections.ts'
import { readIdAt } from '../../shared/readIdentity.ts'
import { readNameAt } from '../../shared/readNameBlock.ts'
import { nextRefAt } from '../../shared/readNextRefs.ts'
import { getOrCreate } from '../../shared/util.ts'
import { hasArcBandInk } from './types.ts'

import type { ReadColorCategory } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { InsertSizeBand } from '../../shared/insertSizeStats.ts'
import type { ArcColorByType } from '../../shared/types.ts'
import type { ArcsUploadData } from './types.ts'

// Arc shape enum. Values are shared with arc.slang (which checks them via
// `> 0.5` / `> 1.5` thresholds); keep in lockstep.
//
// There is a single curved paired-read shape (ARC). Its on-screen form is
// chosen by the *renderer* from how wide the pair is, not by a bp threshold
// here: a rounded dome while both mates fit on screen, collapsing to
// near-vertical lines rising from each real endpoint once the pair spans wider
// than the screen (the circle gets so big the band clips its apex). The
// endpoints always sit at the true genomic coordinates. See arc.slang.
export const ARC_SHAPE_ARC = 0
// read-cloud flat line at Y=|tlen|; the split variant is drawn dashed
// (matching samplot.py's plot_split_plan dotted-line style).
export const ARC_SHAPE_FLAT = 1
export const ARC_SHAPE_FLAT_SPLIT = 2

// Both flat variants (solid read-cloud line + dashed split line) plot as a
// horizontal line with endpoint-square markers, unlike the curved ARC shape.
export function isFlatArcShape(shape: number) {
  return shape === ARC_SHAPE_FLAT || shape === ARC_SHAPE_FLAT_SPLIT
}

// Matches samplot.py --jitter const default (0.08). Applied multiplicatively
// to |tlen| so lines at the same insert size are visually separated.
const CLOUD_JITTER_BOUNDS = 0.08

interface RegionInfo {
  refName: string
  start: number
  end: number
  displayedRegionIndex: number
}

// The two region lists this pass needs, which are NOT the same list and are not
// interchangeable — hence one named object rather than two adjacent
// `RegionInfo[]` parameters nothing could tell apart.
//
// `loaded` is the fetch: `collectArcInputs` walks it to find the reads, and a
// region whose fetch has not landed has none. `displayed` is the VIEW's, and it
// is what a foot's region is resolved against, because the question
// `CrossRegionArc` asks is "can `view.bpToPx` project both feet" and that
// projector reads `displayedRegions`. Keying the partition on the loaded list
// instead leaves the original bug alive for a displayed-but-unfetched partner:
// the far foot resolves to no region, the arc falls into the within-region half,
// and `arcTouchesRegion` hands it to the near foot's block on a raw bp
// comparison — where it is extrapolated and clipped exactly as before.
export interface ArcRegions {
  loaded: RegionInfo[]
  displayed: RegionInfo[]
}

interface ArcSettings {
  colorByType: ArcColorByType
  // read cloud mode: flat lines at Y=|tlen|, concordant FR pairs
  // filtered out so only discordant pairs remain. Coloring follows colorByType
  // (same palette as arcs), not a separate DEL/DUP/INV scheme.
  cloud?: boolean
  drawInter: boolean
  drawLongRange: boolean
  // Whether ordinary concordant pairs get an arc. Shares its definition of
  // "concordant" with the read filter behind "Show proper pairs"
  // (`isConcordantPairRead`). Defaults true — every arc drawn, as before the
  // setting existed.
  drawProperPairArcs?: boolean
  // Reads a translocation breakpoint must gather before its ticks are drawn —
  // see `clusteredInterchromSupport`. 1 (or 0) draws every one, which is what
  // this did before the setting existed.
  minInterchromSupport?: number
  // See `CanonicalRefName`. Without it a split junction between a fetched read
  // (`1`) and its SA segment (`chr1`) reads as inter-chromosomal and paints as a
  // connector tick instead of the intra-chromosomal split-inversion arc.
  // Optional: omitted (tests / no assembly) means no aliasing — identity.
  canonicalRefName?: CanonicalRefName
}

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
function isConcordantFRPair(
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
const COLOR_DEFAULT = 0
const COLOR_LONG_INSERT = 1
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
const COLOR_PAIR_RL = 6
// Split-read inversion, EITHER strand-flip direction (rf/fr) → one magenta
// slot, matching the read-fill + connector split-inversion color.
const COLOR_SPLIT_INVERSION = 7
// Same-strand (co-linear) split — a deletion / tandem-dup junction — → the
// supplementary yellow, matching the read-fill + connector deletion color.
const COLOR_SPLIT_DELETION = 8

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
// through every heavier arc it crossed — and `hitTestArcs`' last-drawn-wins
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
const SPLIT_KIND_COLOR = {
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

export interface SegAln {
  refName: string
  start: number
  end: number
  strand: number
  // soft/hard-clip at the 5' start of the read — read-order sort key
  clipAtStart: number
  // present in the current view (a fetched pileup entry) vs. known only from a
  // sibling's SA tag (maps to a region no displayed region covers)
  onScreen: boolean
}

interface ArcEndpoint {
  refName: string
  bp: number
}

export interface ComputedArc {
  p1: ArcEndpoint
  p2: ArcEndpoint
  colorType: number
  shapeType: number
  yBp: number
  // What the arc's Y MEANS, before the read cloud's jitter is folded into the
  // plotted `yBp`: |TLEN| for a mate link, the breakpoint gap for a split
  // junction, the genomic radius for a curved arc. The reported quantity, as
  // opposed to the drawn one — see `ArcsUploadData.arcSpanBp`.
  spanBp: number
  // The reads standing behind this arc. Always >= 1, and the number
  // `arcLineWidth` turns into a stroke width and the hover reports.
  //
  // HOW THEY ARE COUNTED DEPENDS ON THE FAMILY, because "reads that agree on
  // this junction" is not one measurement:
  //
  //   - Same-chromosome: the connections coalesced onto this exact coordinate
  //     (`resolveArcs`, keyed by `arcKey`). A split read knows its breakpoint to
  //     the base and a pair's endpoints are its own, so agreement IS coincidence
  //     and counting it is exact.
  //   - Interchromosomal: the size of its WINDOWED cluster
  //     (`clusteredInterchromSupport`). Mate-pair support for a translocation
  //     scatters over a fragment length rather than stacking on a base — 862 of
  //     865 connections were the sole occupant of their coordinate on HG002 300x
  //     — so the exact count reads 1 for essentially every one of them. It said
  //     "Supported by 1 read" over a hundred-pair translocation and drew it at
  //     a lone mismapping's weight: the whole channel this field exists to feed,
  //     reading empty in the family that needs it most.
  //
  // Not two meanings — one statement measured the way each family's evidence
  // actually distributes. The windowed count is already what
  // `minInterchromSupport` filters on, so the number drawn and the number
  // filtered are one number rather than two free to disagree.
  //
  // A tick is windowed too, and `pushLine` has the one difference: half a
  // junction can be reached by more than one cluster, so it sums them.
  support: number
  // The `arcKey` this arc was deduped under, so it is unique across the array.
  // Only `resolveArcs`' sort reads it, as the tie-break that makes paint order
  // independent of the order the reads arrived in.
  key: string
}

/**
 * An arc whose two feet are in DIFFERENT displayed regions, carrying the region
 * each foot resolved to.
 *
 * These are separated out because **no per-region pass can draw them**, and the
 * failure is not that they go missing. Both renderers map bp to x through the
 * block's own range — `bpToClipX` off `u.bpHi/bpLo/bpLen` on the GPU,
 * `bpToScreenX(bp, block, …)` on Canvas2D — and the GPU additionally draws into
 * a viewport that IS the block. So an arc with one foot outside gets its far
 * foot extrapolated at the block's own scale, which lands nowhere near where the
 * other block actually sits, and the scissor cuts what is left. Handed to both
 * regions, as it used to be, the reader gets TWO half-curves pointing at
 * nothing.
 *
 * Measured on the HG02768 inverted duplication with its window split into two
 * regions 300 bp apart: 52 of 381 arcs (13.6%) were cross-region, i.e. 104
 * dangling halves. The same view as one region, and the same two regions 2 Mb
 * apart, have none — a fragment can only straddle a seam, so this set is
 * inherently small and an overlay drawn once across the whole view can afford
 * to be SVG. That overlay is the same answer `bezierArcScope`'s `crossRegion`
 * already gives for the per-read connectors, and for the same reason.
 *
 * An interchromosomal arc is necessarily one of these — two refNames cannot
 * share a displayed region — and that is structural rather than incidental
 * because `resolveArcs` decides both from the SAME pair of region lookups. See
 * `groupArcsByRef`, which depends on it.
 */
export interface CrossRegionArc extends ComputedArc {
  p1RegionIndex: number
  p2RegionIndex: number
  // Which way the ARM this junction keeps runs from each foot, as a GENOMIC
  // direction (+1 toward higher coordinates, -1 toward lower). The breakend
  // orientation: outward feet are a deletion-type junction, inward a
  // duplication-type, parallel an inversion, and that grammar is the only thing
  // left saying it once `ARC_COLOR_INTERCHROM` has overwritten an
  // interchromosomal arc's colour. `screenFeet` (crossRegionOverlay.ts) is the
  // one consumer and says which arcs draw them.
  //
  // THE ARM, not "this segment's own aligned body", and the difference is what
  // the two producers have to be read against. They coincide for a split
  // junction, whose endpoint IS the junction — so `connectionEndpointBps` hands
  // its `dir1`/`dir2` straight through. They are OPPOSITE rays for a mate link,
  // whose endpoint is the fragment's outer edge with the read's body pointing
  // back at the junction from it; `pairOuterDir` negates for that reason and
  // carries the worked example.
  //
  // HERE rather than on `ComputedArc`, alongside the region indices and for the
  // same reason: the two are only ever read by the overlay. Nothing per-region
  // draws a foot — `ArcsUploadData` carries no per-foot direction and the GPU
  // pass would have to grow one — and a `ComputedLine` cannot have one at all,
  // since a tick coalesces on a single coordinate and two junctions sharing a
  // breakpoint would silently take whichever read arrived first.
  //
  // Safe on a COALESCED arc, which an arc here always is: the direction is a
  // property of the junction rather than of the read that crossed it — see
  // `readTrailingBodyDir`.
  p1Dir: number
  p2Dir: number
}

// A connector tick. No color: every tick is ARC_COLOR_INTERCHROM (see the
// interchromosomal branch of `resolveArcs` for why that isn't a setting). One
// per distinct breakpoint, not one per supporting read — see `resolveArcs`.
export interface ComputedLine {
  x: ArcEndpoint
  // Reads through this breakpoint, drawn the same way an arc's is:
  // `arcLineWidth` turns it into a stroke width in all three renderers. A
  // translocation carrying 40 reads and one carrying a single mismapped pair are
  // not the same claim, and until the ticks were coalesced there was nowhere for
  // that count to go.
  //
  // Counted the way half a junction has to be: the sum of the sizes of the
  // distinct windowed CLUSTERS reaching this coordinate, each contributing once.
  // `pushLine` has why neither the reads at the coordinate nor one cluster's own
  // size will do, and `ComputedArc.support` the whole-junction case beside it.
  support: number
  // The refName(s) on the FAR side of this breakpoint, sorted and unique. The
  // one fact a tick is drawn to convey and the only one it could not answer: a
  // vertical line at a locus, with the chromosome it points at knowable only by
  // hovering a read underneath. Plural because a breakpoint in a complex
  // rearrangement genuinely reaches more than one chromosome, and collapsing
  // that to "the first one" would be a confident wrong answer.
  partnerRefNames: string[]
}

interface PendingArcEndpoints {
  p1Ref: string
  p1Bp: number
  p1Strand: number
  // Genomic direction of the retained ARM at each foot — see
  // `CrossRegionArc.p1Dir`, which is where it ends up. Resolved by the producer
  // that chose the bp, never re-derived from the strand downstream: which edge
  // an endpoint IS decides it, the producers here choose different edges, and
  // the two that choose the fragment's outer edge answer this with the read's
  // direction NEGATED (`pairOuterDir`).
  p1Dir: number
  p2Ref: string
  p2Bp: number
  p2Strand: number
  p2Dir: number
}

// A split-read junction between two segments of a single read: it carries no
// pair orientation / template length (those are pair concepts), so a discriminated
// union on `isSplit` lets the non-split arm prove `pairOrientationNum`/`tlen`
// are present rather than coercing `undefined` away downstream.
interface SplitPendingArc extends PendingArcEndpoints {
  isSplit: true
}

// A mate link between the two reads of a pair: sourced from the primary's
// orientation + template length.
interface PairedPendingArc extends PendingArcEndpoints {
  isSplit: false
  pairOrientationNum: number
  tlen: number
  // SAM flags of the record the pair fields were sourced from, carried for
  // `isConcordantPairRead` alone — the aligner's own verdict on the pair, which
  // is what "Show concordant-pair arcs" hides. On the split arm there is nothing
  // to carry: a junction between two segments of one read has no pair to call
  // proper, which is the same reason `tlen` and the orientation live here.
  flags: number
}

type PendingArc = SplitPendingArc | PairedPendingArc

// Deterministic 0..1 hash from arc endpoints — gives each pair a stable jitter
// offset regardless of fetch/render order, so snapshot tests don't flake.
// `Math.sin(x)*43758.5453 mod 1` is the standard GPU-style cheap hash.
function pairJitter01(aBp: number, bBp: number) {
  // Order-normalized INSIDE the hash rather than at the call site, so this is a
  // property of the junction and no caller can forget to make it one. The two
  // multipliers differ, so a pair named (a, b) and the same pair named (b, a)
  // hashed to different offsets and drew as two flat lines at slightly
  // different Y — which is the same junction split in two, exactly what
  // `arcKey`'s normalization exists to prevent, and it would have defeated that
  // fix in read-cloud mode since `yBp` is what the two arcs would then differ
  // in. "Stable regardless of fetch/render order" was already the stated
  // contract; mate order is that same kind of accident.
  const p1Bp = Math.min(aBp, bBp)
  const p2Bp = Math.max(aBp, bBp)
  // Math.imul keeps each product a true 32-bit multiply; a plain `*` overflows
  // the 2^53 safe-integer range for large genomic coordinates (bp·constant ≈
  // 1e17) and silently rounds away low bits before the `>>> 0`.
  const seed = (Math.imul(p1Bp, 374761393) + Math.imul(p2Bp, 668265263)) >>> 0
  const x = Math.sin(seed) * 43758.5453
  return x - Math.floor(x)
}

// Pick the shape constant and target Y (in genomic bp) for a single arc.
// Read cloud: flat line with ±8% multiplicative jitter so coincident reads separate
// visually. Y is the pair's genomic span on the shared insert-size axis: a mate
// link plots at Y=|tlen|; a split junction (no tlen) at the full breakpoint gap
// |p2Bp−p1Bp| — NOT half of it, so a split-supported SV lands on the same
// insertSizeTicks ruler height as the equivalent-span discordant pair (and isn't
// mislabeled at half its real size). A pair whose TLEN is *unset* (0 — the SAM
// "information unavailable" encoding, which discordant and supplementary records
// often carry) falls back to that same breakpoint gap, for the reason
// getArcColorType already distrusts TLEN there: plotting it at |0| would park
// exactly the reads read cloud exists to surface on the baseline. Otherwise it's
// the single curved ARC shape (the renderer chooses dome vs vertical-lines by
// zoom); Y is the genomic radius.
function computeArcShape({
  cloud,
  arc,
  absrad,
}: {
  cloud: boolean
  arc: PendingArc
  absrad: number
}) {
  const { p1Bp, p2Bp } = arc
  if (cloud) {
    // `|| gap` reads as the fallback it is: a split junction has no tlen at
    // all, and an unset one is 0. Routing splits through a 0 sentinel so the
    // next line's `> 0` could catch both hid that the union already proves
    // which arm has a tlen.
    const gapBp = Math.abs(p2Bp - p1Bp)
    const spanBp = arc.isSplit ? gapBp : Math.abs(arc.tlen) || gapBp
    const jitter = 1 + CLOUD_JITTER_BOUNDS * (pairJitter01(p1Bp, p2Bp) * 2 - 1)
    return {
      shapeType: arc.isSplit ? ARC_SHAPE_FLAT_SPLIT : ARC_SHAPE_FLAT,
      yBp: Math.round(spanBp * jitter),
      // The jitter is a DRAWING device — it exists so coincident lines don't
      // stack into one — so the span survives it separately for anything that
      // reports a number rather than a position. The hover read `yBp` back as
      // "Insert size", which is that number times a deterministic factor in
      // [0.92, 1.08]: a 10 kb insert was reported as anything from 9.2 to 10.8
      // kb, and reproducibly so, since the factor is a hash of the endpoints.
      spanBp,
    }
  }
  return { shapeType: ARC_SHAPE_ARC, yBp: absrad, spanBp: absrad }
}

// Carries `refName` — unlike the bezier overlay's entry — because this path
// compares a fetched segment against one named only by an SA tag or RNEXT, and
// same-chromosome-ness is the whole difference between an arc and a connector
// tick. That extra field is why the two paths build their own entries; the field
// ACCESSORS are shared (readGroupConnections), which is where the duplication
// that mattered was.
interface ReadEntry {
  displayedRegionIndex: number
  refName: string
  readIdx: number
  data: PileupDataResult
}

// Bucket every fetched read by its QNAME so mates / split segments that share a
// name (possibly across displayed regions) land in the same list. Walks the
// regions rather than the data map, so a region whose fetch has not landed drops
// out and every entry gets its region's refName.
//
// The bezier overlay has the twin of this loop over its own entry type. Sharing
// them was tried and measured back out — see REJECTED_IDEAS, "One shared
// groupReadsByName"; the object build is the hot part and every way of varying
// it generically costs more than the eight lines are worth.
//
// A nameless feature is skipped, the same rule and for the same reason as the
// twin's: a PAF/synteny block carries no QNAME, and one '' bucket made every
// block in view a segment of one enormous read.
function groupReadsByName(
  rpcDataMap: ReadonlyMap<number, PileupDataResult>,
  regions: RegionInfo[],
) {
  const readsByName = new Map<string, ReadEntry[]>()
  for (const region of regions) {
    const data = rpcDataMap.get(region.displayedRegionIndex)
    if (data) {
      for (let i = 0; i < data.readKeys.length; i++) {
        const name = readNameAt(data, i)
        if (name) {
          getOrCreate(readsByName, name, () => []).push({
            displayedRegionIndex: region.displayedRegionIndex,
            refName: region.refName,
            readIdx: i,
            data,
          })
        }
      }
    }
  }
  return readsByName
}

function computePairingInfo(rpcDataMap: ReadonlyMap<number, PileupDataResult>) {
  let hasPaired = false
  let stats: InsertSizeBand | undefined
  for (const data of rpcDataMap.values()) {
    if (!hasPaired) {
      for (let i = 0; i < data.readKeys.length; i++) {
        if (data.readFlags[i]! & SAM_FLAG_PAIRED) {
          hasPaired = true
          break
        }
      }
    }
    if (!stats && data.insertSizeStats) {
      stats = data.insertSizeStats
    }
  }
  return { hasPaired, stats }
}

// Maps a raw BAM refName (SA tag / RNEXT — the file's own naming, e.g. `chr1`)
// to the assembly-canonical name the fetched reads carry (e.g. `1`). Keeping
// every SegAln/PendingArc refName canonical is what stops a same-chr split
// junction from reading as inter-chromosomal.
type CanonicalRefName = (refName: string) => string

// Dependencies threaded through pending-arc EMISSION: the normalizer above plus
// the two user gates that decide whether a connection to a partner this view has
// not loaded is worth emitting at all.
//
// Chain BUILDING takes only the normalizer, which is why that is the narrower
// parameter below rather than this bundle. The gates decide whether a junction
// touching an off-screen segment is emitted as an arc; they say nothing about
// which segments a read has, so a chain builder handed this whole struct had to
// be given values for fields it could not read — and `computeReadChains` duly
// set `drawLongRange: true` under a comment explaining that nothing would look
// at it.
interface ArcChainContext {
  drawLongRange: boolean
  drawInter: boolean
  canonicalRefName: CanonicalRefName
}

// Whether a connection whose far end is NOT loaded in this view is emitted.
//
// The two settings are orthogonal predicates and the menu offers them as
// siblings — "Show off-screen mate connections" is about a partner this view has
// not loaded, "Show inter-chromosomal pairs" about one on another chromosome —
// so either alone has to be able to produce a connection. They were layered
// instead: `drawLongRange` gated EMISSION here and `drawInter` filtered the
// result in `resolveArcs`, which is an AND wearing the costume of an OR.
//
// The case it broke is the ordinary one. A view showing a single chromosome
// never loads the far mate of a translocation, so unticking off-screen mates
// also silently unticked inter-chromosomal pairs: the connector ticks vanished
// while their own checkbox stayed on. Both slots default true, which is why it
// survived — it takes turning one off to see the other stop working.
//
// `drawInter` still filters in `resolveArcs`, so the OR here cannot smuggle an
// interchromosomal connection past a user who turned it off; this only stops the
// other gate from suppressing one first.
function emitsOffScreenPartner(
  ctx: ArcChainContext,
  interchromosomal: boolean,
) {
  return ctx.drawLongRange || (ctx.drawInter && interchromosomal)
}

function entrySeg(entry: ReadEntry): SegAln {
  return {
    refName: entry.refName,
    ...spanOf(entry),
    strand: strandOf(entry),
    clipAtStart: clipAt(entry),
    onScreen: true,
  }
}

// Locus identity of a segment — the dedup key that collapses a fetched segment
// and its SA-tag twin. Two records naming the same refName + start are the same
// alignment, whichever side described it. Sound only because every SegAln's
// refName is canonical (entries already are; SA segments are normalized in
// `saSegments`) and because `readPositions` carries the read's TRUE start
// (buildBaseReadArrays): a start clipped to the region would never match its SA
// twin's un-clipped one, leaving both copies in the chain to be joined as a
// spurious same-strand "deletion".
function segLocusKey(seg: SegAln) {
  return `${seg.refName}:${seg.start}`
}

// The off-screen segments one entry's SA tag names, canonical-refName'd.
// Truncated / placeholder-CIGAR / non-numeric-position SA records parse to a
// zero-length or NaN span and would emit a junk arc, so they're dropped here.
function saSegments(
  entry: ReadEntry,
  canonicalRefName: CanonicalRefName,
): SegAln[] {
  const { data, readIdx } = entry
  return featurizeSA(
    data.readSuppAlignments?.[readIdx],
    readIdAt(data, readIdx)!,
    data.readStrands[readIdx],
    readNameAt(data, readIdx),
  )
    .filter(sa => Number.isFinite(sa.start) && sa.end > sa.start)
    .map(sa => ({
      refName: canonicalRefName(sa.refName),
      start: sa.start,
      end: sa.end,
      strand: sa.strand,
      clipAtStart: sa.clipLengthAtStartOfRead,
      onScreen: false,
    }))
}

// The read's complete segment chain: every on-screen segment (a fetched entry)
// plus any segment named in a sibling's SA tag that no view currently shows,
// deduplicated by locus and sorted into read order by clip-at-start-of-read.
// That single canonical chain is what lets a connector step through an
// off-screen segment and keeps a same-chr split junction from reading as
// inter-chromosomal. `entries` arrives already deduped by readId and stripped of
// secondary alignments — resolveReadGroup's partition owns both rules.
// Takes the normalizer alone, not an `ArcChainContext`: the SA walk is how a
// read's segments are DISCOVERED, so it always runs, and `drawLongRange` only
// decides which of the resulting junctions are drawn (`unpairedChainArcs`).
function unpairedReadChain(
  entries: ReadEntry[],
  canonicalRefName: CanonicalRefName,
): SegAln[] {
  const byPos = new Map<string, SegAln>()
  // On-screen segments first, so a segment described by BOTH a fetched record
  // and a sibling's SA tag keeps the on-screen record (first writer wins).
  for (const seg of [
    ...entries.map(entrySeg),
    ...entries.flatMap(e => saSegments(e, canonicalRefName)),
  ]) {
    const key = segLocusKey(seg)
    if (!byPos.has(key)) {
      byPos.set(key, seg)
    }
  }
  return [...byPos.values()].sort((a, b) => a.clipAtStart - b.clipAtStart)
}

/**
 * #api
 * Every fetched read's complete segment chain, in read order. Routed through
 * the same `resolveReadGroup` skeleton the arcs use, so the secondary filter,
 * the readId dedup and the mate partition are applied identically and the two
 * cannot disagree about which segments belong to one read.
 *
 * The arc path turns each chain into junction arcs; `derivativePaths` reads the
 * chains themselves to propose a derivative allele. Sharing the builder is what
 * keeps the proposal's segment ORDER and ORIENTATION honest: read order is not
 * genomic order across an inversion, and `unpairedReadChain` is where that is
 * already resolved.
 *
 * Chains of one segment are dropped: a read with no junction describes no
 * rearrangement.
 */
export function computeReadChains(
  rpcDataMap: ReadonlyMap<number, PileupDataResult>,
  regions: RegionInfo[],
  canonicalRefName: CanonicalRefName = refName => refName,
): SegAln[][] {
  const chains: SegAln[][] = []
  for (const entries of groupReadsByName(rpcDataMap, regions).values()) {
    chains.push(
      ...resolveReadGroup<ReadEntry, SegAln[]>(entries, {
        chainMate: segs => [unpairedReadChain(segs, canonicalRefName)],
        // A mate link joins two mates of one fragment; it is not a junction on
        // a single molecule, so it contributes no segment to a path.
        mateLink: () => [],
      }).filter(chain => chain.length > 1),
    )
  }
  return chains
}

// The junction between two read-adjacent segments: the first segment's
// read-trailing (3') edge joined to the next segment's read-leading (5') edge,
// so a fwd→rev inversion lands on the breakpoint rather than the far edge of the
// reverse segment. One spelling of the `connectionEndpointBps` call, so the
// SegAln path can't disagree with the entry path (`pendingArcFromConnection`)
// about which edges a split junction connects.
function splitJunctionArc(a1: SegAln, a2: SegAln): PendingArc {
  const { bp1, bp2, dir1, dir2 } = connectionEndpointBps({
    s1: a1.strand,
    start1: a1.start,
    end1: a1.end,
    s2: a2.strand,
    start2: a2.start,
    end2: a2.end,
    isSplit: true,
  })
  return {
    p1Ref: a1.refName,
    p1Bp: bp1,
    p1Strand: a1.strand,
    p1Dir: dir1,
    p2Ref: a2.refName,
    p2Bp: bp2,
    p2Strand: a2.strand,
    p2Dir: dir2,
    isSplit: true,
  }
}

// Chain an unpaired read's segments in true read order (by clip-at-start-of-read,
// which getClip already makes strand-correct), connecting each segment's
// read-trailing (3') edge to the next segment's read-leading (5') edge — so a
// fwd→rev inversion joins at the breakpoint, not the far edge of the reverse
// segment. A junction between two on-screen segments always draws; one touching
// an off-screen segment is a connection to something this view has not loaded,
// emitted on `emitsOffScreenPartner` — this is also what suppresses a misleading
// direct join across an off-screen segment (the flanking pair are not actually
// read-adjacent). A translocation supported by a split read reaches its far
// chromosome exactly the way an off-screen mate does, so it takes the same gate:
// dropping it whenever off-screen mates were off left "Show inter-chromosomal
// pairs" with no split-read evidence to draw.
function unpairedChainArcs(
  entries: ReadEntry[],
  ctx: ArcChainContext,
): PendingArc[] {
  const chain = unpairedReadChain(entries, ctx.canonicalRefName)
  const arcs: PendingArc[] = []
  for (let j = 0; j < chain.length - 1; j++) {
    const a1 = chain[j]!
    const a2 = chain[j + 1]!
    if (
      (a1.onScreen && a2.onScreen) ||
      emitsOffScreenPartner(ctx, a1.refName !== a2.refName)
    ) {
      arcs.push(splitJunctionArc(a1, a2))
    }
  }
  return arcs
}

// A mate's own outer (5', read-leading) edge — the fragment boundary TLEN is
// measured from, as opposed to connectionEndpointBps' read-trailing edge (built
// for split-junction/bezier connectors, which want the facing GAP between two
// drawn segments). Using the gap edges for a mate-link arc understated its span
// by both mates' own lengths, so the dome's width silently disagreed with the
// TLEN driving its color (a pair could look unremarkably small yet be painted
// long-insert, or vice versa).
function pairOuterBp(entry: ReadEntry) {
  const { start, end } = spanOf(entry)
  return readLeadingBp(strandOf(entry), start, end)
}

// The foot direction that goes with `pairOuterBp`'s edge, and it is the READ'S
// OWN DIRECTION NEGATED — `readTrailingBodyDir`, not the `readLeadingBodyDir`
// that mirrors the bp above. The asymmetry is the whole point, so it is worth
// saying why before someone lines the two ternaries up again.
//
// A foot says which ARM the junction keeps, measured from the junction. A split
// junction's endpoint IS the junction, so there "the arm" and "this segment's
// own aligned body" are the same ray and `connectionEndpointBps` can answer with
// one ternary. A mate link's endpoint is the FRAGMENT's outer edge, a read
// length outside the junction, and from there the read's body points INWARD, at
// the junction — the opposite ray. Both rays lie inside the retained arm, so
// both readings are defensible in isolation; what is not defensible is the two
// producers disagreeing, since nothing in the picture says which evidence drew a
// given arc.
//
// So: taking the read's own direction here made an FR pair — the deletion-type
// signature — draw INWARD feet, which the mark's grammar spells "duplication",
// while a split read over the identical junction drew outward. On a translocation
// with both kinds of support the two land within a fragment length of each other,
// in one colour, pointing opposite ways. `arcBreakendFeet.test.ts` pins the two
// families against each other rather than against a remembered ±1.
function pairOuterDir(entry: ReadEntry) {
  return readTrailingBodyDir(strandOf(entry))
}

// The mate link between the two reads of one pair, sourcing orientation and
// template length from a primary segment (see `pairFieldEntry`, which owns that
// rule for this path and for the bezier overlay alike).
//
// Split junctions do not come through here. The arc path chains a read's
// segments as `SegAln`s so it can walk off-screen SA records, and
// `splitJunctionArc` is that path's junction builder — so this took a
// `ReadConnection` and branched on `isSplit` for an arm the one call site
// (`mateLink`, which passes `isSplit: false` literally) could never reach. The
// dead arm was also the only consumer of `connectionEndpoints` here: the live
// arm asked it for two endpoints and then overwrote both.
//
// Those endpoints are each read's own outer (5') edge — the fragment boundary
// TLEN is measured from — not `connectionEndpointBps`' read-trailing edges,
// which are built for split/bezier connectors and want the facing GAP between
// two drawn segments. Using the gap edges understated a mate link's span by
// both mates' own lengths, so the dome's width silently disagreed with the TLEN
// driving its color.
function mateLinkArc(e1: ReadEntry, e2: ReadEntry): PairedPendingArc {
  const src = pairFieldEntry(e1, e2)
  return {
    p1Ref: e1.refName,
    p1Bp: pairOuterBp(e1),
    p1Strand: strandOf(e1),
    p1Dir: pairOuterDir(e1),
    p2Ref: e2.refName,
    p2Bp: pairOuterBp(e2),
    p2Strand: strandOf(e2),
    p2Dir: pairOuterDir(e2),
    isSplit: false,
    pairOrientationNum: src.data.readPairOrientations[src.readIdx]!,
    tlen: src.data.readInsertSizes[src.readIdx]!,
    // Off the SAME entry the orientation and tlen come from — `pairFieldEntry`
    // picks a primary, and the proper-pair flag is a pair field like the other
    // two. Taking it off `e1` instead would read a supplementary's flags where
    // the other two read a primary's.
    flags: flagsOf(src),
  }
}

// The link to a mate that isn't on screen: only RNEXT/PNEXT locate it, so this
// is the one connection kind the bezier overlay can't draw and the arc path can.
// Gated on `emitsOffScreenPartner` — either user setting can ask for it, and a
// translocation seen from a single-chromosome view has ONLY this path, which is
// why "Show inter-chromosomal pairs" is one of the two — and on the mate
// actually having a locus. An unmapped mate has none; neither does a record
// naming a real RNEXT with PNEXT 0, which SAM spells "unavailable" and
// `parseSam` maps to `undefined`. Substituting bp 0 there drew a
// full-chromosome arc down to the origin.
//
// The `!mateBp` half of that test is what catches the second case, and it is
// approximate in the one direction that costs nothing: `extractFeatureArrays`
// stores the absent position as 0 (`readNextPositions` is a Uint32Array with no
// sentinel to spare), so a mate genuinely aligned to the FIRST BASE of a contig
// reads as absent and its arc is not drawn. Separating the two would mean
// zeroing the read's mate-reference slot at extraction time, where `undefined`
// is still visible — which also moves `buildReadInterchrom` and the tooltip's
// RNEXT, for a mate at base 0 of a contig with its arc off screen. Not worth
// the three consumers; recorded so it is not re-derived.
// The RNEXT `*` case is NOT this test's: `nextRefAt` already answers `''` for a
// BAM `next_refid` -1, and `parseSam` maps a literal `*` to `undefined`.
//
// The arc connects the read's own outer (5') edge — the fragment boundary TLEN
// measures from — to the recorded mate position. Only PNEXT (the mate's
// leftmost/5' base) is known off-screen, not the mate's CIGAR/length, so for a
// forward-strand mate the far endpoint lands at its 5' edge rather than its true
// 3' end (off by one read length). Negligible at arc-view zoom; exact resolution
// would need the off-screen mate's alignment.
function offScreenMateArcs(
  entry: ReadEntry,
  ctx: ArcChainContext,
): PendingArc[] {
  const { data, readIdx, refName } = entry
  const mateRef = nextRefAt(data, readIdx)
  const mateBp = data.readNextPositions?.[readIdx]
  const mateUnmapped = (flagsOf(entry) & SAM_FLAG_MATE_UNMAPPED) !== 0
  if (mateUnmapped || !mateRef || !mateBp) {
    return []
  }
  // Normalized before the comparison, not after: an SA/RNEXT `chr1` against a
  // fetched `1` is the same chromosome, and asking the gate with the raw name
  // would call every aliased mate a translocation.
  const mateCanonRef = ctx.canonicalRefName(mateRef)
  if (!emitsOffScreenPartner(ctx, mateCanonRef !== refName)) {
    return []
  }
  const strand = strandOf(entry)
  const mateStrand = flagsOf(entry) & SAM_FLAG_MATE_REVERSE ? -1 : 1
  return [
    {
      p1Ref: refName,
      // The pair family's edge and its foot direction, through the two helpers
      // that own them together rather than spelled again here — this endpoint is
      // the same fragment-outer edge `mateLinkArc` places, and the direction is
      // the half that reads backwards on its own (see `pairOuterDir`).
      p1Bp: pairOuterBp(entry),
      p1Strand: strand,
      p1Dir: pairOuterDir(entry),
      p2Ref: mateCanonRef,
      p2Bp: mateBp,
      p2Strand: mateStrand,
      // The mate's arm direction, carrying the SAME read-length approximation
      // `p2Bp` already does: PNEXT is the mate's leftmost base, so for a reverse
      // mate the fragment boundary this direction is measured from is one read
      // length to the right of where the foot is placed. Negligible at arc-view
      // zoom, for the reason above — and the alternative of reporting no
      // direction throws away the orientation, which for an interchromosomal
      // pair is the whole of what the mark has to say.
      p2Dir: readTrailingBodyDir(mateStrand),
      pairOrientationNum: data.readPairOrientations[readIdx]!,
      tlen: data.readInsertSizes[readIdx]!,
      flags: flagsOf(entry),
      isSplit: false,
    },
  ]
}

// Every QNAME group resolves the same way — the bezier overlay's group
// resolution (resolveReadGroup owns the secondary filter, the readId dedup, the
// mate partition, and the mate-link guard) with two arc-path substitutions:
//
//   - the SA-augmented per-mate chainer, which steps through an off-screen SA
//     segment (gated by drawLongRange) so a 3rd, off-screen split segment still
//     gets its junctions instead of being skipped over. The bezier path chains
//     only on-screen entries, so the SA walk lives here rather than leaking
//     pseudo-entries into the shared skeleton;
//   - the off-screen mate link, which only this path can draw.
//
// An unpaired (long) read falls out as the case where the partition puts every
// segment on one side and neither mate hook fires.
function collectPendingArcs(
  readsByName: Map<string, ReadEntry[]>,
  ctx: ArcChainContext,
) {
  const pendingArcs: PendingArc[] = []
  for (const entries of readsByName.values()) {
    pendingArcs.push(
      ...resolveReadGroup<ReadEntry, PendingArc>(entries, {
        chainMate: segs => unpairedChainArcs(segs, ctx),
        mateLink: mateLinkArc,
        loneMateLink: primary => offScreenMateArcs(primary, ctx),
      }),
    )
  }
  return pendingArcs
}

// Per-group half of the pipeline: the expensive read grouping + connection
// resolution, plus the two dataset facts a pooled scale is built from. Split out
// so every group's arcs exist before any of them is colored.
interface ArcInputs {
  pendingArcs: PendingArc[]
  hasPaired: boolean
  stats: InsertSizeBand | undefined
}

function collectArcInputs(
  rpcDataMap: ReadonlyMap<number, PileupDataResult>,
  regions: RegionInfo[],
  settings: ArcSettings,
): ArcInputs {
  const readsByName = groupReadsByName(rpcDataMap, regions)
  const { hasPaired, stats } = computePairingInfo(rpcDataMap)
  const pendingArcs = collectPendingArcs(readsByName, {
    drawLongRange: settings.drawLongRange,
    drawInter: settings.drawInter,
    canonicalRefName: settings.canonicalRefName ?? (refName => refName),
  })
  return { pendingArcs, hasPaired, stats }
}

// Everything that decides an arc's COLOR but belongs to the whole fetched read
// set rather than to one group. Pooled for the same reason the worker pools
// `insertSizeStats` and the model maxes `arcsYDomainBp` across groups: a
// per-group scale paints the same pair long-insert in one stacked section and
// normal in the next, and `hasPaired` switches whole lanes between the
// pair-orientation and split-junction branches of `getArcColorType`. `stats` is
// already the worker's pooled band, so pooling it here is just picking the one
// value every group carries.
interface ArcScale {
  hasPaired: boolean
  stats: InsertSizeBand | undefined
}

function poolArcScale(inputs: ArcInputs[]): ArcScale {
  return {
    hasPaired: inputs.some(i => i.hasPaired),
    stats: inputs.find(i => i.stats !== undefined)?.stats,
  }
}

// The identity of a drawn arc: two endpoints, a colour, a shape and the Y it
// plots at. Two connections agreeing on all five produce the same pixels, which
// is what makes them summable.
//
// `yBp` IS part of the key, and the argument for leaving it out — that it is
// derived from the endpoints and the shape, so arcs agreeing on the rest agree
// on it — holds in arc mode and fails in read cloud. There a mate link's Y is
// |TLEN|, a field of the record rather than a function of the drawn endpoints,
// and the two diverge exactly where the cloud is interesting: an outward-facing
// (RL) pair anchors at its mates' inner edges while TLEN spans their outer
// ones, so two RL pairs sharing those inner edges and differing in read length
// carry different template lengths. They drew as two lines at two heights and
// coalesced into one, which loses a line and reports the survivor as supported
// by both reads. In arc mode `yBp` is the half-span, so adding it here groups
// nothing differently.
//
// EXACT COORDINATES, deliberately, and it is the same rule sashimi's
// `junctionKey` follows for the same reason. A tolerance looks like the obvious
// improvement — aligners do wobble a junction by a base or two — but junctions
// genuinely cluster at this scale: over the HG002 chr12 fold-back the reads put
// feet at 86,845,554 / 86,846,342 / 86,846,818 / 86,847,127 / 86,847,804, five
// distinct events inside 2.3 kb. Merging on tolerance would draw them as one
// thick arc, which states something the data does not.
// The separator is NUL because a refName may contain any printable character —
// including the ':' and '-' a locstring uses — and two fields that can collide
// under a printable separator collapse two junctions into one arc. It must stay
// written as the ESCAPE `\0`: as a raw NUL byte in the source (which is how it
// was first committed) the file reads as binary, so `grep`, `rg` and every
// editor search silently skip all 1000 lines of it.
function arcKey(a: {
  p1Ref: string
  p1Bp: number
  p2Ref: string
  p2Bp: number
  colorType: number
  shapeType: number
  yBp: number
}) {
  // ENDPOINT ORDER IS NORMALIZED, because the drawn arc is symmetric in it and
  // so the key has to be. `strokeArc` centres on (p1+p2)/2 with |p2-p1|/2 as its
  // half-width and `arcShape.test.ts` pins that as endpoint-order independent;
  // the shader takes min/max of the two. A junction whose reads name the mates
  // the other way round therefore paints the identical pixels.
  //
  // Keying on the raw order did not fold those together, and that halved the
  // very channel this key exists to feed. Measured over the HG02768 inverted
  // duplication (1:39,658,200-39,661,800): the junction at 39,658,994 /
  // 39,660,047 resolved as TWO arcs, support 7 and support 4, drawn on top of
  // each other in the same opaque colour — so its stroke width reported 7 reads
  // (or 4, whichever painted last) at a junction 11 reads support. Which of the
  // two you saw depended on nothing the reader can see.
  const swap = a.p1Ref === a.p2Ref ? a.p2Bp < a.p1Bp : a.p2Ref < a.p1Ref
  const [r1, b1, r2, b2] = swap
    ? [a.p2Ref, a.p2Bp, a.p1Ref, a.p1Bp]
    : [a.p1Ref, a.p1Bp, a.p2Ref, a.p2Bp]
  return `${r1}\0${b1}\0${r2}\0${b2}\0${a.colorType}\0${a.shapeType}\0${a.yBp}`
}

// The Y an interchromosomal arc plots at: the top of the band, at every zoom.
//
// Arc mode's axis is GENOMIC RADIUS, and an interchromosomal connection has no
// radius — but the ceiling is not an invented position on it either. It is
// exactly where a maximally-far same-chromosome pair already ends up:
// `arcYOffsetPx` clamps its offset to `availH`, and in arc mode the domain is
// the bp span that FITS the band at the current zoom, so any pair wider than
// that is already drawn there. The arc says "as far as this axis goes" rather
// than claiming a distance it does not have.
//
// Uint32 max, because it has to exceed that zoom-dependent domain at every zoom
// (the largest it reaches is ~availH * bpPerPx, three orders below this even on
// a whole-genome view of a mammalian assembly) and because `arcYBp` is a
// Uint32Array — which an interchromosomal arc never reaches, being cross-region
// by construction, but the value should not be the thing that depends on it.
const INTERCHROM_ARC_YBP = 0xffffffff

// Fallback clustering window when the fetch produced no insert-size band —
// unpaired data, or too few proper pairs to characterize one. A translocation
// found by split reads rather than by mates has its evidence at the breakpoint
// itself, so a window is not what it needs; this is only so the pass has a
// finite number when `stats` is absent.
const DEFAULT_INTERCHROM_WINDOW_BP = 1000

// Which reads agree on each interchromosomal connection, grouped over a WINDOW
// rather than at a coordinate — see `InterchromClusters` for the shape and why
// it is an identity rather than the count it returned first.
//
// BOTH MARKS' OWN `support` COMES OUT OF THIS, not just the floor's input — see
// `ComputedArc.support` and `pushLine` — which is why it runs at every setting
// rather than only above the floor.
//
// A mate-pair breakpoint is not localized to a base. The two mates straddle it,
// so a read supporting a translocation can start anywhere within about one
// fragment length of it, and the fetched pairs land scattered across that span
// rather than stacked on a coordinate. `arcKey` counts exact coincidences, which
// is right for the split junctions it was written for (a split read KNOWS the
// breakpoint to the base — see its comment, and the HG002 chr12 fold-back it
// cites) and counts almost nothing here: measured on HG002 300x over 200 kb at
// 1:2,000,000, 862 of 865 interchromosomal connections were the sole occupant of
// their coordinate.
//
// So a support floor over `arcKey`'s count would delete a real translocation as
// thoroughly as the noise — every one of its hundred supporting pairs is a
// singleton at its own bp. Counting over a window is what makes the floor mean
// "this breakpoint has evidence" instead of "two reads happened to start on the
// same base".
//
// BOTH SIDES have to agree, and that is the discriminator. Real supporting pairs
// cluster at the source AND point into the same window on the partner
// chromosome; mismapping clusters at neither. A one-sided window would instead
// merge unrelated breakpoints that happen to sit near each other, manufacturing
// support out of local density — which is exactly how the same-chromosome
// version of this idea failed when it was measured (see
// `agent-docs/reference/DEEP_COVERAGE.md`), and is why this is offered for the
// interchromosomal family only.
//
// Single-linkage on each side in turn, so a run of reads stepping across the
// span stays one cluster: group the sorted entries into runs on `bpA`, then
// re-sort each run on `bpB` and run the same rule again. Two sorts and two
// linear passes, and no comparison of an entry against a cluster's members.
//
// Chaining ONE open cluster along `bpA` and testing each entry's `bpB` against
// its members is what this replaces, and it lost reads to the order they arrived
// in. Real support and mismapping interleave along the source contig, so a noise
// entry sorts into the middle of a real cluster; failing the mate test, it closed
// that cluster and opened its own, and the supporting pairs after it were counted
// as a separate event. Measured on the five-pair fixture in `compute.test.ts`, a
// four-read breakpoint scored 1 and 3 — below the default floor of 2 for the
// first of them, and below any floor the real count clears.
// One interchromosomal connection, in the endpoint order the clustering keys on:
// `bpA` on the lexicographically-first contig, `bpB` on the other, `index` back
// into the caller's `pendingArcs`.
interface ClusterEntry {
  index: number
  bpA: number
  bpB: number
}

// The clustering's answer, as an IDENTITY per connection rather than the bare
// count it used to be, because the two marks spend it differently. An arc is a
// whole junction, so its number is its own cluster's size and an index into
// `sizeOf` says it. A tick is half a junction and several clusters can reach one
// coordinate, so it sums the DISTINCT ones — which no per-connection number can
// answer, since adding two connections of one cluster would double it. See
// `pushLine`.
interface InterchromClusters {
  // Cluster index per `pendingArcs` entry, -1 for an intra-chromosomal one.
  // Those are never read: the caller asks only from inside its own
  // interchromosomal branch, so walking the whole array is what lets the two
  // agree BY INDEX rather than by a counter kept in step with a filter.
  clusterOf: number[]
  // Connections in each cluster, indexed by cluster.
  sizeOf: number[]
}

function clusteredInterchromSupport(
  arcs: PendingArc[],
  windowBp: number,
): InterchromClusters {
  const clusterOf = new Array<number>(arcs.length).fill(-1)
  const sizeOf: number[] = []
  // ENDPOINT ORDER IS NORMALIZED before anything is keyed or compared, on
  // refName, which is `arcKey`'s rule and is here for the same reason: the
  // event is symmetric in endpoint order, so the count over it has to be.
  //
  // Which direction a connection arrives in is chance. `mateLinkArc` puts the
  // FIRST-IN-PAIR mate at p1, and which mate of a pair landed on which contig
  // is nothing but which end of the fragment was sequenced first, so one
  // translocation reaches here as chr1->chr7 from some of its pairs and as
  // chr7->chr1 from the others. Keyed raw, those are two clusters carrying half
  // the support each — and at the default floor of 2 an event supported by one
  // pair in each direction vanishes outright, both clusters counting 1. That is
  // the ordinary two-region SV view, where both contigs are on screen and every
  // pair therefore resolves as a mate link rather than as an off-screen one.
  //
  // Only the COUNTING is folded. Each tick still draws at the coordinate its own
  // read put it at — see the caller.
  //
  // The normalized endpoints are carried on one small record per
  // INTERCHROMOSOMAL arc rather than in two arrays sized to `arcs`: intra-chrom
  // connections outnumber these by ~10:1 on deep short-read data (9204 arcs, 865
  // of them interchromosomal, measured at 1:2,000,000 on HG002 300x), and only
  // `support` has to span the whole feed.
  const byContigPair = new Map<string, ClusterEntry[]>()
  for (let i = 0; i < arcs.length; i++) {
    const arc = arcs[i]!
    if (arc.p1Ref === arc.p2Ref) {
      continue
    }
    const swap = arc.p2Ref < arc.p1Ref
    const key = swap
      ? `${arc.p2Ref}\0${arc.p1Ref}`
      : `${arc.p1Ref}\0${arc.p2Ref}`
    getOrCreate(byContigPair, key, () => []).push({
      index: i,
      bpA: swap ? arc.p2Bp : arc.p1Bp,
      bpB: swap ? arc.p1Bp : arc.p2Bp,
    })
  }
  for (const entries of byContigPair.values()) {
    entries.sort((a, b) => a.bpA - b.bpA)
    forEachRun(
      entries,
      e => e.bpA,
      windowBp,
      run => {
        run.sort((a, b) => a.bpB - b.bpB)
        forEachRun(
          run,
          e => e.bpB,
          windowBp,
          cluster => {
            const id = sizeOf.length
            sizeOf.push(cluster.length)
            for (const m of cluster) {
              clusterOf[m.index] = id
            }
          },
        )
      },
    )
  }
  return { clusterOf, sizeOf }
}

// Single-linkage runs over a list already sorted on `valueOf`: a run ends
// wherever consecutive values are further apart than `windowBp`.
function forEachRun<T>(
  sorted: T[],
  valueOf: (item: T) => number,
  windowBp: number,
  onRun: (run: T[]) => void,
) {
  let start = 0
  for (let i = 1; i <= sorted.length; i++) {
    if (
      i === sorted.length ||
      valueOf(sorted[i]!) - valueOf(sorted[i - 1]!) > windowBp
    ) {
      onRun(sorted.slice(start, i))
      start = i
    }
  }
}

// Colour + shape one group's resolved connections against the pooled scale,
// COALESCING connections that would draw as the same arc.
//
// Every read spanning a junction used to contribute its own instance, and arc
// colours are opaque with no alpha, so N identical arcs were pixel-identical to
// one: the picture said "a junction is here" and could not say how many reads
// said so. Measured on the HG002 chr12 fold-back, a 24 kb window: 89
// connections over 38 distinct arcs, the busiest drawn 27 times, and a 6-read
// junction 689 bp away drawn with exactly the same weight as the 27-read one.
//
// Coalescing is what lets support become a channel (`arcLineWidth`) instead of
// being thrown away, and it removes the redundant instances rather than
// stacking them: 57% of the arcs in that window were exact repeats.
//
// The read-cloud jitter does not stop two identical pairs coalescing: it hashes
// the same two bp to the same offset (`pairJitter01`), so arcs agreeing on the
// endpoints agree on it. What it does NOT make agree is the span the offset
// scales — see `arcKey`, which is why `yBp` is keyed on.
//
// THREE outputs, from ONE region lookup per connection. The alternative — emit
// arcs, then partition them in a second pass — was written first and is worse
// for a reason that is not style: the second pass has to ask "which region is
// this foot in" all over again, so "an interchromosomal arc is always in the
// cross-region set" holds only as long as the two lookups agree. Deciding it
// here, off `p1RegionIndex`/`p2RegionIndex` resolved once, makes it structural,
// which is what `groupArcsByRef` and `arcTouchesRegion` both rely on.
function resolveArcs(
  pendingArcs: PendingArc[],
  { hasPaired, stats }: ArcScale,
  settings: ArcSettings,
  displayedRegions: RegionInfo[],
) {
  const {
    colorByType,
    cloud = false,
    drawInter,
    drawProperPairArcs = true,
    minInterchromSupport = 1,
  } = settings
  const arcs: ComputedArc[] = []
  const crossRegion: CrossRegionArc[] = []
  // ONE map over both arrays. An arc is pushed to exactly one of them on first
  // sight and the later `support++` mutates that same object, so the count
  // cannot end up on a copy in the other half.
  const byKey = new Map<string, ComputedArc>()
  const lines: ComputedLine[] = []
  // The tick, plus the clusters already counted into it — see `pushLine`. The
  // set is off `ComputedLine` because it is bookkeeping for the coalescing, not
  // a field of the mark, and it is one element for all but a coordinate two
  // events share.
  const byLineKey = new Map<
    string,
    { line: ComputedLine; clusters: Set<number> }
  >()

  // The window is the LIBRARY's, not a constant: how far a supporting read can
  // sit from the breakpoint is one fragment length, and `stats.upper` is the
  // number this pipeline already computes for it. A hardcoded window would be
  // wrong at both ends — too wide to discriminate on a 150 bp amplicon library,
  // too narrow to hold one cluster together on a 3 kb mate-pair library, where
  // it would split a real translocation into the singletons the floor then eats.
  //
  // RUN AT EVERY SETTING, including the menu's `all` position where nothing can
  // be filtered out, because the floor is no longer the only consumer: this is
  // also what an interchromosomal mark's `support` IS. See
  // `ComputedArc.support`. The pass builds one small record per
  // interchromosomal connection and sorts it — ~10% of the feed on deep
  // short-read data — against an `arcKey` string built for every connection that
  // survives, so making it unconditional is not what this loop costs.
  const { clusterOf, sizeOf } = clusteredInterchromSupport(
    pendingArcs,
    stats?.upper ?? DEFAULT_INTERCHROM_WINDOW_BP,
  )

  // One tick per breakpoint, COUNTING the reads that agree on it — the same
  // move `arcKey` makes for arcs, and for the same two reasons.
  //
  // Every read over a translocation used to push its own pair of ticks. Opaque
  // marks at one x, so N of them were pixels-identical to one: the picture said
  // "a breakpoint is here" and could not say how many reads said so. Worse, the
  // GPU pass shades its edges by coverage (`strokeCoverage`), so the duplicates
  // alpha-composited and a 50-read breakpoint drew a perceptibly wider,
  // harder-edged tick than a 1-read one, while the Canvas2D mirror strokes
  // opaque and drew the two the same.
  //
  // Coalescing is what lets `support` become a channel (`arcLineWidth`, the
  // same curve the arcs use) instead of being thrown away, and what gives the
  // hover something to report. Deduping alone would have been lossy.
  //
  // THE SUM OF THE DISTINCT CLUSTERS reaching this coordinate, which is neither
  // of the two obvious numbers and is the only one that survives both cases.
  //
  // Counting the connections AT the coordinate — which this did — is the
  // measurement the interchromosomal family was already shown not to have. Mate
  // pairs straddle a breakpoint rather than landing on it, so the count is 1 for
  // 862 of 865 connections (`ComputedArc.support`), and the tick is the mark a
  // SINGLE-chromosome view draws for a translocation: the arc half of the fix
  // never reaches it. Worse, `minInterchromSupport` gates a tick on its cluster,
  // so a five-pair breakpoint cleared a floor of 2 and then drew, and hovered,
  // as one read.
  //
  // Taking the cluster's own size instead understates the other way: two
  // singleton events sharing a chr1 base (`a breakpoint reaching two chromosomes
  // names both`) would report the larger, 1, for the two reads sitting there.
  // `partnerRefNames` is plural for exactly that shape.
  //
  // So: each cluster contributes its size ONCE. A tick is half a junction, and
  // the reads standing behind the halves that meet here is what it can say. Its
  // two coordinates of one event do both report the whole event — the same trade
  // an arc makes, and for the same reason: the mark is the junction and the
  // POSITION is its own read's.
  function pushLine(
    refName: string,
    bp: number,
    partnerRef: string,
    cluster: number,
    clusterSupport: number,
  ) {
    const key = `${refName}\0${bp}`
    const seen = byLineKey.get(key)
    if (seen) {
      if (!seen.clusters.has(cluster)) {
        seen.clusters.add(cluster)
        seen.line.support += clusterSupport
      }
      if (!seen.line.partnerRefNames.includes(partnerRef)) {
        seen.line.partnerRefNames.push(partnerRef)
      }
      return
    }
    const line = {
      x: { refName, bp },
      support: clusterSupport,
      partnerRefNames: [partnerRef],
    }
    byLineKey.set(key, { line, clusters: new Set([cluster]) })
    lines.push(line)
  }

  // One arc per distinct junction, COALESCING the reads that agree on it — the
  // same move `pushLine` makes for the ticks, keyed by `arcKey`.
  //
  // It also files each arc into the half that can DRAW it, off the two region
  // indices resolved once per connection above. BOTH producers go through here,
  // and that is what makes "an interchromosomal arc is never in the per-region
  // feed" structural rather than a rule two branches happen to agree on: two
  // refNames cannot land in one displayed region, so the cross-region branch is
  // the only one such an arc can take. `groupArcsByRef` is keyed on exactly that.
  function pushArc(
    arc: Omit<ComputedArc, 'support' | 'key'>,
    p1RegionIndex: number | undefined,
    p2RegionIndex: number | undefined,
    // The two arm directions, carried through from the producer that chose the
    // endpoints. Taken here rather than on `arc` because they are only kept on
    // the cross-region half — see `CrossRegionArc.p1Dir`.
    feetDirs: { p1Dir: number; p2Dir: number },
    // The reads this connection already stands for, when its family cannot be
    // counted a read at a time — `ComputedArc.support`. Absent means COUNT: each
    // connection is one more read agreeing on this junction to the base.
    clusterSupport?: number,
  ) {
    const key = arcKey({
      p1Ref: arc.p1.refName,
      p1Bp: arc.p1.bp,
      p2Ref: arc.p2.refName,
      p2Bp: arc.p2.bp,
      colorType: arc.colorType,
      shapeType: arc.shapeType,
      yBp: arc.yBp,
    })
    const seen = byKey.get(key)
    if (seen) {
      // Nothing to add on the clustered arm, and that is an invariant rather
      // than a shortcut: every connection coalescing onto one arc shares both
      // coordinates, so it is in the same cluster and arrived with the same
      // number. One arc is one junction is one cluster.
      if (clusterSupport === undefined) {
        seen.support++
      }
      return
    }
    const computed: ComputedArc = {
      ...arc,
      support: clusterSupport ?? 1,
      // kept for the sort's tie-break below, where it is the only thing that
      // does not depend on what order the reads arrived in
      key,
    }
    byKey.set(key, computed)
    // pushed in first-seen order, so the feed's order is still the reads' —
    // a later support bump mutates the entry already in the array
    //
    // An arc with EITHER foot in no displayed region is not cross-region: that
    // is the off-screen-partner case, which has no second pixel to draw to and
    // keeps `arcTouchesRegion`'s existing handling, where the leg rising toward
    // the screen edge is the correct picture.
    if (
      p1RegionIndex !== undefined &&
      p2RegionIndex !== undefined &&
      p1RegionIndex !== p2RegionIndex
    ) {
      // `Object.assign`, not a spread: the object identity has to be the one in
      // `byKey`, or a later `support++` lands on an arc nothing draws.
      crossRegion.push(
        // Named one at a time rather than spread: the callers hand their whole
        // `PendingArc` in, so a spread would copy `p1Ref`, `tlen`, `isSplit` and
        // the rest onto an arc nothing reads them off.
        Object.assign(computed, {
          p1RegionIndex,
          p2RegionIndex,
          p1Dir: feetDirs.p1Dir,
          p2Dir: feetDirs.p2Dir,
        }),
      )
    } else {
      arcs.push(computed)
    }
  }

  for (let i = 0; i < pendingArcs.length; i++) {
    const arc = pendingArcs[i]!
    const { p1Ref, p1Bp, p2Ref, p2Bp } = arc
    // THE region lookup for this connection, and the only one. Every decision
    // below about where the arc can be drawn is taken from these two.
    //
    // Above every filter rather than beside the one caller that needs it today:
    // the interchromosomal branch asks the same question (commit 3's arc-or-tick
    // decision), and two lookup sites is how the invariant `groupArcsByRef`
    // depends on stops being structural. The cost is a scan of a 1-2 element
    // list, which is nothing next to the `arcKey` string this loop builds for
    // every connection that survives.
    const p1RegionIndex = regionIndexOf(displayedRegions, p1Ref, p1Bp)
    const p2RegionIndex = regionIndexOf(displayedRegions, p2Ref, p2Bp)
    // Interchromosomal. Always painted the single dedicated interchromosomal
    // colour: insert size, long-range distance and pair orientation are all
    // meaningless across refs (a cross-chromosome "pair orientation" is
    // arbitrary), so colouring by them just produces visual noise — one uniform
    // colour regardless of colorByType, and regardless of whether the evidence
    // is a split read or a mate pair. As a TICK that was because the mark
    // carries no colour of its own (ARC_COLOR_INTERCHROM lives in arcLine.slang,
    // where the pass reads it). As an ARC the reason is stronger: "crosses
    // chromosomes" used to be readable from the mark itself, and it is not from
    // a curve — a same-chromosome cross-region arc crosses the same panel
    // divider — so the colour is now the ONLY channel carrying it.
    if (p1Ref !== p2Ref) {
      // ONE gate over both marks, which is the point of hoisting it: `drawInter`
      // and the mismapping floor used to sit inside the tick push, so an arc
      // branch added beside them would have inherited neither — "Show
      // inter-chromosomal pairs: off" still drawing arcs, and the floor bypassed
      // for connections that now draw a BIGGER mark than the ticks they replace.
      //
      // Scattered IS the criterion for that floor, so it drops the whole
      // connection rather than merging it: a breakpoint whose reads cluster
      // keeps every mark at the coordinate its own read put it at. Merging a
      // cluster would have to invent a position for it, which is the thing
      // `arcKey`'s exact-coordinate rule exists to refuse.
      // The reads behind this connection, and the number both its marks are
      // drawn and reported with — see `ComputedArc.support`. The tick also takes
      // the cluster's IDENTITY, because a coordinate several events reach adds
      // each of them once (`pushLine`).
      const cluster = clusterOf[i]!
      const support = sizeOf[cluster]!
      if (drawInter && support >= minInterchromSupport) {
        // AN ARC WHEN BOTH FEET ARE ON SCREEN, ticks otherwise — decided per
        // connection, so a breakpoint reaching one displayed and one undisplayed
        // chromosome gets an arc *and* a tick and both counts stay honest.
        //
        // Replacing the ticks rather than drawing beside them, because a tick's
        // whole job is "there is a connection to somewhere you cannot see",
        // which is precisely false in this configuration. No position is lost:
        // the arc's feet are the two tick positions.
        //
        // NOT IN READ-CLOUD MODE, and that exclusion is the severe one. The
        // cloud's Y axis IS insert size and an interchromosomal connection has
        // none: it carries TLEN 0 (SAM sets it so across refs), so
        // `computeArcShape` would fall back to the endpoint GAP — |ctgBbp -
        // ctgAbp|, about 1.07e8 for a real chr9/chr22 junction — and that
        // becomes a genuine `maxFlatArcSpanBp`, which `arcsYDomainBp` maxes
        // across every group, which `insertSizeTickSections` prints on the
        // ruler. One connection would rescale the whole read cloud to a 107 Mb
        // "insert size" and label it. Arc mode's axis is genomic radius, where
        // the band ceiling is not an invented position — see
        // `INTERCHROM_ARC_YBP`.
        if (
          !cloud &&
          p1RegionIndex !== undefined &&
          p2RegionIndex !== undefined
        ) {
          pushArc(
            {
              p1: { refName: p1Ref, bp: p1Bp },
              p2: { refName: p2Ref, bp: p2Bp },
              colorType: ARC_COLOR_INTERCHROM,
              shapeType: ARC_SHAPE_ARC,
              yBp: INTERCHROM_ARC_YBP,
              // No reported quantity: the hover prints two POSITIONS for this
              // arc rather than a span, since a bp distance across a
              // translocation is a subtraction of two unrelated number lines.
              // Inert rather than arbitrary — `maxFlatArcSpanBp` reads only flat
              // shapes and `formatArcTooltip` only ARC_SHAPE_FLAT.
              spanBp: 0,
            },
            p1RegionIndex,
            p2RegionIndex,
            arc,
            support,
          )
        } else {
          // Each endpoint's tick names the OTHER endpoint's chromosome — that is
          // the whole content of a translocation marker, and the direction is
          // what makes the two ticks different marks rather than a mirrored
          // pair. The one whose chromosome is not displayed reaches no region
          // and is dropped by `lineTouchesRegion`.
          pushLine(p1Ref, p1Bp, p2Ref, cluster, support)
          pushLine(p2Ref, p2Bp, p1Ref, cluster, support)
        }
      }
      continue
    }

    // Read cloud suppresses the modal-insert FR pairs so SV signals stand out.
    // Split junctions have no template length, so they never qualify.
    //
    // NOT the same test as the one above, deliberately: this asks whether |TLEN|
    // sits in the modal band, that one asks what the aligner concluded. The
    // cloud exists to surface anything anomalous in SIZE, so it must catch a
    // pair the flags call proper; `isConcordantPairRead`'s comment has the full
    // split. Both can apply — the cloud's is unconditional in cloud mode and the
    // setting above still filters on top of it.
    if (
      cloud &&
      !arc.isSplit &&
      isConcordantFRPair(arc.pairOrientationNum, arc.tlen, stats)
    ) {
      continue
    }

    const absrad = Math.abs((p2Bp - p1Bp) / 2)

    // No bp distance ever hides or reshapes a both-mates-visible pair: every
    // pair renders as an arc. "Long range" is purely the *visual* result of
    // zoom — a far-apart arc collapses to near-vertical lines at its real
    // endpoints (arc.slang), and zooming out to show the whole span restores
    // the rounded arc. (drawLongRange only gates connections to mates that
    // aren't loaded in the current view; see `offScreenMateArcs`.)
    const colorType = getArcColorType({
      arc,
      colorByType,
      hasPaired,
      stats,
    })
    // The user's own suppression of the ordinary case, and the reason it is a
    // setting where the cloud's is not: in ARC mode the concordant domes are the
    // context a discordant pair is read against, so on shallow data they earn
    // their ink. At depth they stop being context and become the picture — 9138
    // of 9204 arcs at 1:2,000,000 on HG002 300x, all painting the baseline slot,
    // with the 66 that mean something riding on top of them
    // (agent-docs/reference/DEEP_COVERAGE.md).
    //
    // TWO conditions, and the second is what keeps the setting honest.
    //
    // `isConcordantPairRead` is the READ filter's rule, shared verbatim, so
    // "Show proper pairs" and this hide the same pairs — one the reads, the
    // other their arcs. But that rule reads the aligner's verdict, and the arc's
    // COLOUR can disagree with it: a pair flagged proper whose |TLEN| falls
    // below the insert band paints short-insert. Hiding it would take a pink arc
    // off the screen under a setting about ordinary pairs, which reads as a bug
    // — measured, it was 42 of the 48 short-insert arcs in that window.
    //
    // So it must ALSO be painting the baseline slot: nothing the display is
    // currently drawing as a category can be hidden as routine, whatever the
    // flags say. `arcPaintRank` is the same classifier the paint order uses, so
    // "hidden" and "grey" are the same set by construction, and both follow
    // `colorByType` — under `orientation` a short insert IS routine, and the
    // setting agrees without being told.
    //
    // A split junction has no pair to call proper and is never suppressed: it is
    // evidence whatever the reads around it are flagged.
    if (
      !drawProperPairArcs &&
      !arc.isSplit &&
      arcPaintRank(colorType) === 0 &&
      isConcordantPairRead(arc.flags, arc.pairOrientationNum)
    ) {
      continue
    }

    pushArc(
      {
        p1: { refName: p1Ref, bp: p1Bp },
        p2: { refName: p2Ref, bp: p2Bp },
        colorType,
        ...computeArcShape({ cloud, arc, absrad }),
      },
      p1RegionIndex,
      p2RegionIndex,
      arc,
    )
  }

  arcs.sort(arcPaintOrder)
  // The same TOTAL order over the overlay's half, for the same reason one level
  // down: SVG document order is paint order, and equal-support arcs left in the
  // reads' arrival order are not in the same order twice.
  crossRegion.sort(arcPaintOrder)

  // The same ordering, for the same reason, over the ticks. They are opaque
  // full-band verticals, so two within a stroke width of each other resolve by
  // paint order, and `hitTestArcBand` reads the feed's order as its
  // last-drawn-wins tie-break. Total on the breakpoint's own bp, which is
  // unique per tick after the coalescing above.
  lines.sort((a, b) => a.support - b.support || a.x.bp - b.x.bp)
  // Sorted, so a tooltip listing two partners lists them the same way twice.
  // First-seen order is the reads' arrival order, which is not stable across
  // runs — the trap `arcs.sort`'s tie-break is written up for, one field over.
  for (const line of lines) {
    line.partnerRefNames.sort()
  }

  return { arcs, crossRegion, lines }
}

// Which displayed region a genomic point falls in, or undefined for a point no
// region shows. First match wins: two displayed regions may overlap in bp (the
// same locus shown twice, a foldback laid out in derivative order), and an
// arbitrary-but-consistent answer beats none — `makeBpToScreenX` breaks the same
// tie the same way, by preferring the index it is given and falling back to the
// first match.
function regionIndexOf(regions: RegionInfo[], refName: string, bp: number) {
  for (const r of regions) {
    if (r.refName === refName && bp >= r.start && bp <= r.end) {
      return r.displayedRegionIndex
    }
  }
  return undefined
}

function bucketByRef<T>(items: T[], refOf: (item: T) => string) {
  const byRef = new Map<string, T[]>()
  for (const item of items) {
    getOrCreate(byRef, refOf(item), () => []).push(item)
  }
  return byRef
}

// Group computed arcs and lines by the refName they belong to so callers
// can look up the per-region subset in O(1) instead of filtering the full
// array once per displayed region.
//
// Keyed on `p1` alone, and `arcTouchesRegion` below compares raw bp with no
// refName test at all. Both are safe because of WHERE the arcs reaching here
// come from, not because an arc cannot span two chromosomes: `resolveArcs` sends
// every arc whose feet resolve to two different displayed regions to
// `crossRegion` instead, and two refNames cannot share a displayed region. So a
// two-refName arc is excluded by the region partition, one decision earlier and
// from the same two lookups the interchromosomal arc/tick choice is made from —
// which is why that partition has to stay a single decision point. An
// interchromosomal arc that did reach here would be bucketed under one
// chromosome and then projected at a garbage x inside it, silently.
// `compute.test.ts` pins the invariant rather than the reasoning.
export function groupArcsByRef(arcs: ComputedArc[], lines: ComputedLine[]) {
  return {
    arcsByRef: bucketByRef(arcs, arc => arc.p1.refName),
    linesByRef: bucketByRef(lines, line => line.x.refName),
  }
}

// Whether an arc can paint any ink inside one region's block, which is the
// question "does this arc belong in that region's buffer" — refName equality is
// only half of it.
//
// A mark's horizontal extent is the span between its two feet: a dome runs foot
// to foot, a far pair's legs rise AT the feet, and a flat read-cloud bar lies
// between them. So an arc with both feet outside the region on the same side
// draws nothing in it. The block is inside the loaded region by construction —
// `isBlockCovered` is what gates rendering on exactly that — so measuring
// against the region is the conservative form of measuring against the block.
//
// Without this, every displayed region on a chromosome received every arc on
// that chromosome. Harmless to look at (the far copies project off-block and the
// scissor eats them) and not free: it multiplied the pack, the upload and the
// per-mousemove `hitTestArcBand` walk by the number of same-ref regions. That is
// the multi-region SV view, which is what read connections are for.
//
// An arc reaching NO region is one whose every endpoint is off-screen — the
// junction between two off-screen SA segments of one read, which `drawLongRange`
// admits and which used to be uploaded everywhere and clipped away everywhere.
// It now reaches nothing, which also takes it out of `maxFlatArcSpanBp`: an arc
// that cannot be drawn no longer sizes the read cloud's shared Y axis.
function arcTouchesRegion(arc: ComputedArc, region: RegionInfo) {
  const { bp: b1 } = arc.p1
  const { bp: b2 } = arc.p2
  return Math.min(b1, b2) <= region.end && Math.max(b1, b2) >= region.start
}

// A connector tick is a single bp with no horizontal extent beyond its own
// stroke, so it belongs to the region containing it and to no other.
function lineTouchesRegion(line: ComputedLine, region: RegionInfo) {
  return line.x.bp >= region.start && line.x.bp <= region.end
}

export function arcsToRegionResult(
  regionArcs: ComputedArc[],
  regionLines: ComputedLine[],
): ArcsUploadData {
  const arcX1 = new Uint32Array(regionArcs.length)
  const arcX2 = new Uint32Array(regionArcs.length)
  const arcColorTypes = new Uint8Array(regionArcs.length)
  const arcShapeTypes = new Uint8Array(regionArcs.length)
  const arcYBp = new Uint32Array(regionArcs.length)
  const arcSpanBp = new Uint32Array(regionArcs.length)
  const arcSupport = new Uint32Array(regionArcs.length)

  let numFlatArcs = 0
  // The reported span, not the drawn `yBp`: the read cloud's Y axis autoscales
  // to this and its top tick is labelled with it, so taking it off the jittered
  // position printed a template length no read has. See `maxFlatArcSpanBp`.
  let maxFlatArcSpanBp = 0
  for (let i = 0; i < regionArcs.length; i++) {
    const arc = regionArcs[i]!
    arcX1[i] = arc.p1.bp
    arcX2[i] = arc.p2.bp
    arcColorTypes[i] = arc.colorType
    arcShapeTypes[i] = arc.shapeType
    arcYBp[i] = arc.yBp
    arcSpanBp[i] = arc.spanBp
    arcSupport[i] = arc.support
    if (isFlatArcShape(arc.shapeType)) {
      numFlatArcs++
      if (arc.spanBp > maxFlatArcSpanBp) {
        maxFlatArcSpanBp = arc.spanBp
      }
    }
  }

  // One entry per connector tick — the arcLine pass self-expands each instance
  // to the two band-edge vertices (see arcLine.slang / packInstances).
  const arcLinePositions = new Uint32Array(regionLines.length)
  const arcLineSupport = new Uint32Array(regionLines.length)
  const arcLinePartnerRefNames: string[][] = []
  for (let i = 0; i < regionLines.length; i++) {
    const line = regionLines[i]!
    arcLinePositions[i] = line.x.bp
    arcLineSupport[i] = line.support
    arcLinePartnerRefNames.push(line.partnerRefNames)
  }

  return {
    arcX1,
    arcX2,
    arcColorTypes,
    arcShapeTypes,
    arcYBp,
    arcSpanBp,
    arcSupport,
    numArcs: regionArcs.length,
    numFlatArcs,
    maxFlatArcSpanBp,
    arcLinePositions,
    arcLineSupport,
    arcLinePartnerRefNames,
    numArcLines: regionLines.length,
  }
}

// Bucket one group's computed arcs by refName, narrow each bucket to the region
// actually asking, then materialize that region's `ArcsUploadData`.
//
// TWO steps, not one, because the refName bucket is a Map lookup that skips
// every other chromosome's arcs outright while the bp narrowing is a scan of
// what survives it. Regions may overlap in bp and an arc spanning two of them
// belongs to both, so the second step is a per-region filter rather than a
// second bucketing — see `arcTouchesRegion`.
function arcsToRegionMap(
  { arcs, lines }: { arcs: ComputedArc[]; lines: ComputedLine[] },
  regions: RegionInfo[],
): Map<number, ArcsUploadData> {
  const { arcsByRef, linesByRef } = groupArcsByRef(arcs, lines)
  const out = new Map<number, ArcsUploadData>()
  for (const ri of regions) {
    out.set(
      ri.displayedRegionIndex,
      arcsToRegionResult(
        (arcsByRef.get(ri.refName) ?? []).filter(a => arcTouchesRegion(a, ri)),
        (linesByRef.get(ri.refName) ?? []).filter(l =>
          lineTouchesRegion(l, ri),
        ),
      ),
    )
  }
  return out
}

/**
 * Arcs + cross-region arcs + connector ticks for one group's raw pileup data,
 * scaled to that group alone. The single-group entry point; grouped rendering
 * goes through `computeArcsByGroup` instead, which pools the color scale across
 * every lane.
 *
 * `displayedRegions` defaults to the fetched list, which is the truth in the
 * single-region view this entry point describes — see `ArcRegions` for when the
 * two genuinely differ and why the difference matters.
 */
export function computeArcsFromPileupData(
  rpcDataMap: ReadonlyMap<number, PileupDataResult>,
  regions: RegionInfo[],
  settings: ArcSettings,
  displayedRegions: RegionInfo[] = regions,
) {
  const inputs = collectArcInputs(rpcDataMap, regions, settings)
  return resolveArcs(
    inputs.pendingArcs,
    poolArcScale([inputs]),
    settings,
    displayedRegions,
  )
}

/**
 * Everything one fetch's arcs are: both drawable halves, plus the three facts
 * that are asked ACROSS the lanes rather than of one.
 *
 * Those three used to be walks of `byGroup` in the model, and splitting the
 * cross-region arcs out of it broke two of them at once — a legend swatch keyed
 * off arcs that had moved, a Y domain sized without them, a band strip reserved
 * for a lane whose ink was now entirely in the overlay. They were not three
 * slips: "which arcs does this lane draw" had stopped having one answer. They
 * are outputs of the pass holding both halves for that reason, and a third half
 * would have to come through here too.
 *
 * All three are computed AFTER regionization, which is the other half of the
 * same rule. An arc reaching no displayed region at all is dropped by
 * `arcTouchesRegion`, so keying a swatch off the pre-regionization set would
 * name a colour nothing draws.
 */
export interface ArcsByGroupResult {
  byGroup: Map<string, Map<number, ArcsUploadData>>
  // The arcs no per-region buffer can draw, per group — see `CrossRegionArc`.
  // Empty in the single-region view, which is why the overlay that draws them
  // costs nothing there.
  crossRegionByGroup: Map<string, CrossRegionArc[]>
  // The lanes with ANY arc-band ink, in either half. Drives the per-section band
  // reservation: a lane whose reads yield no arc and no tick reserves no strip,
  // so its pileup starts right under its coverage. A lane whose every arc
  // crosses a seam — two windows either side of a breakpoint, the view read
  // connections exist for — has ink in the overlay only, and must still reserve.
  inkGroupKeys: Set<string>
  // The arc colour slots actually drawn, across every lane. The legend maps them
  // through `arcColorLegendCategory`, which needs a setting this pass doesn't
  // have, so the slots stay raw here.
  colorSlots: Set<number>
  // The largest reported flat-arc span, which is the read cloud's Y domain: its
  // axis autoscales to this and `insertSizeTickSections` labels the top tick
  // with it. 0 when nothing flat is drawn.
  maxFlatArcSpanBp: number
}

/**
 * The full arc upload feed for every group of one fetch.
 *
 * Resolution runs per group (a read belongs to exactly one lane, and each lane
 * draws its own band), but the color scale is characterized ONCE across all of
 * them — see `poolArcScale`. Resolving every group before coloring any is what
 * makes that possible at no extra cost: the expensive half already had to run
 * per group.
 *
 * Every group handed in is pooled, so a lane the display doesn't draw must not
 * be in the map: it would shift the scale the visible lanes share. That is the
 * caller's `rawDataByGroup`, which drops `hiddenGroupKeys` at the source
 * (`buildRawDataByGroup`) precisely so no walk of it — this one included — has
 * to re-apply the rule.
 */
export function computeArcsByGroup(
  rawDataByGroup: ReadonlyMap<string, Map<number, PileupDataResult>>,
  regions: ArcRegions,
  settings: ArcSettings,
): ArcsByGroupResult {
  // Each group carries its own collected input rather than sitting in a second
  // array indexed in step with this one: the pooling in between is the whole
  // reason collection and resolution are separate passes, and two parallel
  // arrays make "same index" an invariant to hold rather than one to read.
  const groups = [...rawDataByGroup].map(([key, rawMap]) => ({
    key,
    input: collectArcInputs(rawMap, regions.loaded, settings),
  }))
  const scale = poolArcScale(groups.map(g => g.input))
  const byGroup = new Map<string, Map<number, ArcsUploadData>>()
  const crossRegionByGroup = new Map<string, CrossRegionArc[]>()
  const inkGroupKeys = new Set<string>()
  const colorSlots = new Set<number>()
  let maxFlatArcSpanBp = 0
  for (const { key, input } of groups) {
    const { arcs, crossRegion, lines } = resolveArcs(
      input.pendingArcs,
      scale,
      settings,
      regions.displayed,
    )
    // The per-region feed is keyed on the LOADED list, unchanged: it is what a
    // block draws from, and a displayed region whose fetch has not landed has
    // no block to draw.
    const regionMap = arcsToRegionMap({ arcs, lines }, regions.loaded)
    byGroup.set(key, regionMap)
    crossRegionByGroup.set(key, crossRegion)

    // The cross-group facts, over BOTH halves and AFTER regionization — see
    // `ArcsByGroupResult`.
    let hasInk = crossRegion.length > 0
    for (const data of regionMap.values()) {
      if (hasArcBandInk(data)) {
        hasInk = true
      }
      for (const ct of data.arcColorTypes) {
        colorSlots.add(ct)
      }
      // A tick carries no per-instance colour — every one of them is
      // ARC_COLOR_INTERCHROM (arcLine.slang) — so their presence, not a scan of
      // their colours, is what keys the swatch.
      if (data.numArcLines > 0) {
        colorSlots.add(ARC_COLOR_INTERCHROM)
      }
      if (data.maxFlatArcSpanBp > maxFlatArcSpanBp) {
        maxFlatArcSpanBp = data.maxFlatArcSpanBp
      }
    }
    for (const arc of crossRegion) {
      colorSlots.add(arc.colorType)
      if (isFlatArcShape(arc.shapeType) && arc.spanBp > maxFlatArcSpanBp) {
        maxFlatArcSpanBp = arc.spanBp
      }
    }
    if (hasInk) {
      inkGroupKeys.add(key)
    }
  }
  return {
    byGroup,
    crossRegionByGroup,
    inkGroupKeys,
    colorSlots,
    maxFlatArcSpanBp,
  }
}
