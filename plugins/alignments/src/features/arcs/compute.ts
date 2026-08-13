import { splitJunctionKind } from '@jbrowse/alignments-core'
import {
  connectionEndpointBps,
  featurizeSA,
  readLeadingBp,
  SAM_FLAG_MATE_REVERSE,
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_PAIRED,
} from '@jbrowse/cigar-utils'

import { ARC_SLOT_CATEGORY } from '../../shaders/palettes.ts'
// Generated constants, imported from the generated modules with no re-export
// hop through palettes.ts (SHADER_JS_CODEGEN.md).
import { ARC_COLOR_SHORT_INSERT } from '../../shaders/slang/arc.iface.generated.ts'
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

interface ArcSettings {
  colorByType: ArcColorByType
  // read cloud mode: flat lines at Y=|tlen|, concordant FR pairs
  // filtered out so only discordant pairs remain. Coloring follows colorByType
  // (same palette as arcs), not a separate DEL/DUP/INV scheme.
  cloud?: boolean
  drawInter: boolean
  drawLongRange: boolean
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
  // How many connections were coalesced into this arc — see `resolveArcs`.
  // Always >= 1.
  support: number
  // The `arcKey` this arc was deduped under, so it is unique across the array.
  // Only `resolveArcs`' sort reads it, as the tie-break that makes paint order
  // independent of the order the reads arrived in.
  key: string
}

// A connector tick. No color: every tick is ARC_COLOR_INTERCHROM (see the
// interchromosomal branch of `resolveArcs` for why that isn't a setting). One
// per distinct breakpoint, not one per supporting read — see `resolveArcs`.
export interface ComputedLine {
  x: ArcEndpoint
  // Reads through this breakpoint, exactly as `ComputedArc.support` counts them
  // for an arc, and drawn the same way: `arcLineWidth` turns it into a stroke
  // width in all three renderers. A translocation carrying 40 reads and one
  // carrying a single mismapped pair are not the same claim, and until the
  // ticks were coalesced there was nowhere for that count to go.
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
  p2Ref: string
  p2Bp: number
  p2Strand: number
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
  const { bp1, bp2 } = connectionEndpointBps({
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
    p2Ref: a2.refName,
    p2Bp: bp2,
    p2Strand: a2.strand,
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
    p2Ref: e2.refName,
    p2Bp: pairOuterBp(e2),
    p2Strand: strandOf(e2),
    isSplit: false,
    pairOrientationNum: src.data.readPairOrientations[src.readIdx]!,
    tlen: src.data.readInsertSizes[src.readIdx]!,
  }
}

// The link to a mate that isn't on screen: only RNEXT/PNEXT locate it, so this
// is the one connection kind the bezier overlay can't draw and the arc path can.
// Gated on `emitsOffScreenPartner` — either user setting can ask for it, and a
// translocation seen from a single-chromosome view has ONLY this path, which is
// why "Show inter-chromosomal pairs" is one of the two — and on the mate
// actually having a locus: an unmapped mate has none, and neither does a record
// that claims a mapped mate while naming RNEXT `*` / PNEXT 0 (BAM next_refid
// -1). Substituting this read's own refName and bp 0 there drew a
// full-chromosome arc down to the origin.
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
  const { start, end } = spanOf(entry)
  return [
    {
      p1Ref: refName,
      p1Bp: readLeadingBp(strand, start, end),
      p1Strand: strand,
      p2Ref: mateCanonRef,
      p2Bp: mateBp,
      p2Strand: flagsOf(entry) & SAM_FLAG_MATE_REVERSE ? -1 : 1,
      pairOrientationNum: data.readPairOrientations[readIdx]!,
      tlen: data.readInsertSizes[readIdx]!,
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

// Fallback clustering window when the fetch produced no insert-size band —
// unpaired data, or too few proper pairs to characterize one. A translocation
// found by split reads rather than by mates has its evidence at the breakpoint
// itself, so a window is not what it needs; this is only so the pass has a
// finite number when `stats` is absent.
const DEFAULT_INTERCHROM_WINDOW_BP = 1000

// How many reads agree on each interchromosomal connection, counted over a
// WINDOW rather than at a coordinate — returns the per-connection support, index
// for index with `arcs`.
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
// Single-linkage, so a run of reads stepping across the span stays one cluster.
// The `some` is over one cluster's mates and clusters are 1-2 members on real
// data, so this is linear in practice; a genuine translocation makes one big
// cluster and pays a few thousand comparisons once.
function clusteredInterchromSupport(
  arcs: PendingArc[],
  windowBp: number,
): number[] {
  const support = new Array<number>(arcs.length).fill(0)
  // Keyed on the ORDERED pair of contigs: a connection chr1->chr7 and one
  // chr7->chr1 are the two ends of one event and are emitted as two separate
  // pending arcs, each of which gets its own cluster at its own end.
  const byContigPair = new Map<string, number[]>()
  for (const [i, arc] of arcs.entries()) {
    getOrCreate(byContigPair, `${arc.p1Ref}\0${arc.p2Ref}`, () => []).push(i)
  }
  for (const indices of byContigPair.values()) {
    indices.sort((a, b) => arcs[a]!.p1Bp - arcs[b]!.p1Bp)
    let members: number[] = []
    let mates: number[] = []
    let lastBp = 0
    const flush = () => {
      for (const m of members) {
        support[m] = members.length
      }
    }
    for (const i of indices) {
      const arc = arcs[i]!
      if (
        members.length > 0 &&
        arc.p1Bp - lastBp <= windowBp &&
        mates.some(m => Math.abs(m - arc.p2Bp) <= windowBp)
      ) {
        members.push(i)
        mates.push(arc.p2Bp)
      } else {
        flush()
        members = [i]
        mates = [arc.p2Bp]
      }
      lastBp = arc.p1Bp
    }
    flush()
  }
  return support
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
function resolveArcs(
  pendingArcs: PendingArc[],
  { hasPaired, stats }: ArcScale,
  settings: ArcSettings,
) {
  const {
    colorByType,
    cloud = false,
    drawInter,
    minInterchromSupport = 1,
  } = settings
  const arcs: ComputedArc[] = []
  const byKey = new Map<string, ComputedArc>()
  const lines: ComputedLine[] = []
  const byLineKey = new Map<string, ComputedLine>()

  // The window is the LIBRARY's, not a constant: how far a supporting read can
  // sit from the breakpoint is one fragment length, and `stats.upper` is the
  // number this pipeline already computes for it. A hardcoded window would be
  // wrong at both ends — too wide to discriminate on a 150 bp amplicon library,
  // too narrow to hold one cluster together on a 3 kb mate-pair library, where
  // it would split a real translocation into the singletons the floor then eats.
  //
  // Skipped outright at support 1, which is the default: the pass is pure
  // overhead when nothing can be filtered out.
  const interchromSupport =
    minInterchromSupport > 1
      ? clusteredInterchromSupport(
          pendingArcs.filter(a => a.p1Ref !== a.p2Ref),
          stats?.upper ?? DEFAULT_INTERCHROM_WINDOW_BP,
        )
      : undefined
  // Walked in step with the filtered array above rather than indexed by the
  // outer loop's position, which counts intra-chromosomal arcs too.
  let interchromIdx = 0

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
  function pushLine(refName: string, bp: number, partnerRef: string) {
    const key = `${refName}\0${bp}`
    const seen = byLineKey.get(key)
    if (seen) {
      seen.support++
      if (!seen.partnerRefNames.includes(partnerRef)) {
        seen.partnerRefNames.push(partnerRef)
      }
      return
    }
    const line = {
      x: { refName, bp },
      support: 1,
      partnerRefNames: [partnerRef],
    }
    byLineKey.set(key, line)
    lines.push(line)
  }

  for (const arc of pendingArcs) {
    const { p1Ref, p1Bp, p2Ref, p2Bp } = arc
    // Interchromosomal: never an arc — drop a tick on each endpoint, always
    // painted the single dedicated interchromosomal color. Insert size,
    // long-range distance, and pair orientation are all meaningless across refs
    // (a cross-chromosome "pair orientation" is arbitrary), so coloring by them
    // just produces visual noise — every translocation tick is one uniform
    // color regardless of colorByType. That is why a tick carries no color of
    // its own: ARC_COLOR_INTERCHROM is the whole rule, and it lives in
    // arcLine.slang where the pass reads it.
    if (p1Ref !== p2Ref) {
      // Scattered IS the criterion, so the filter drops the whole connection
      // rather than merging it: a breakpoint whose reads cluster keeps every
      // tick at the coordinate its own read put it at, and the dense picket of
      // them is what a translocation looks like. Merging a cluster into one tick
      // would have to invent a position for it, which is the thing `arcKey`'s
      // exact-coordinate rule exists to refuse.
      const support = interchromSupport?.[interchromIdx++]
      if (
        drawInter &&
        (support === undefined || support >= minInterchromSupport)
      ) {
        // Each endpoint's tick names the OTHER endpoint's chromosome — that is
        // the whole content of a translocation marker, and the direction is
        // what makes the two ticks different marks rather than a mirrored pair.
        pushLine(p1Ref, p1Bp, p2Ref)
        pushLine(p2Ref, p2Bp, p1Ref)
      }
      continue
    }

    // Read cloud suppresses the modal-insert FR pairs so SV signals stand out.
    // Split junctions have no template length, so they never qualify.
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
    const { shapeType, yBp, spanBp } = computeArcShape({ cloud, arc, absrad })

    const key = arcKey({ p1Ref, p1Bp, p2Ref, p2Bp, colorType, shapeType, yBp })
    const seen = byKey.get(key)
    if (seen) {
      seen.support++
      continue
    }
    const computed = {
      p1: { refName: p1Ref, bp: p1Bp },
      p2: { refName: p2Ref, bp: p2Bp },
      colorType,
      shapeType,
      yBp,
      spanBp,
      support: 1,
      // kept for the sort's tie-break below, where it is the only thing that
      // does not depend on what order the reads arrived in
      key,
    }
    byKey.set(key, computed)
    // pushed in first-seen order, so the feed's order is still the reads' —
    // a later support bump mutates the entry already in the array
    arcs.push(computed)
  }

  // CATEGORY FIRST, then ASCENDING SUPPORT, because array order is paint order
  // and the strokes are opaque: the last arc drawn over a shared pixel is the
  // one that keeps it.
  //
  // `arcPaintRank` is the coarse key — every arc that says something paints
  // over every arc that does not; see it for why a deep pileup needs that.
  // Support orders each rank internally: first-seen order is the reads' order,
  // which is arbitrary with respect to support, so a singleton fetched late
  // punched a gap through every heavier arc it crossed — and `hitTestArcs`'
  // last-drawn-wins tie-break then handed those pixels to it too. Heaviest-last
  // is the ranking `arcLineWidth` exists to express, and it is what lets the hit
  // test resolve an overlap toward the strongest junction and still be
  // describing the arc on top.
  //
  // TOTAL, tie-broken on the dedup key, because "the reads' order they arrived
  // in" — which is what a merely stable sort leaves equal-support arcs in — is
  // not the same order twice. Reads reach `pendingArcs` as their fetches
  // complete, so on a loaded machine a different interleaving produces a
  // different paint order among equal-support arcs, and paint order is what
  // decides the color of every pixel where two of them cross.
  //
  // It surfaced as an intermittently failing image snapshot: AlignmentArcs'
  // out-of-view-pairing frame came back 4.9% different, with the whole
  // difference inside the arc band and the reads and coverage below it
  // pixel-identical — the data was the same, only the order it was painted in
  // had changed. `key` is what arcs are deduped by, so no two share it and this
  // is a strict weak ordering; which arc wins a tie does not matter, only that
  // the same one wins it every time.
  arcs.sort(
    (a, b) =>
      arcPaintRank(a.colorType) - arcPaintRank(b.colorType) ||
      a.support - b.support ||
      (a.key < b.key ? -1 : 1),
  )

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

  return { arcs, lines }
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
// Keyed on `p1` alone because an arc's two ends always share a refName: the
// interchromosomal branch of `resolveArcs` turns those into a pair of ticks and
// never reaches here.
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
 * Arcs + connector ticks for one group's raw pileup data, scaled to that group
 * alone. The single-group entry point; grouped rendering goes through
 * `computeArcsByGroup` instead, which pools the color scale across every lane.
 */
export function computeArcsFromPileupData(
  rpcDataMap: ReadonlyMap<number, PileupDataResult>,
  regions: RegionInfo[],
  settings: ArcSettings,
) {
  const inputs = collectArcInputs(rpcDataMap, regions, settings)
  return resolveArcs(inputs.pendingArcs, poolArcScale([inputs]), settings)
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
  regions: RegionInfo[],
  settings: ArcSettings,
): Map<string, Map<number, ArcsUploadData>> {
  // Each group carries its own collected input rather than sitting in a second
  // array indexed in step with this one: the pooling in between is the whole
  // reason collection and resolution are separate passes, and two parallel
  // arrays make "same index" an invariant to hold rather than one to read.
  const groups = [...rawDataByGroup].map(([key, rawMap]) => ({
    key,
    input: collectArcInputs(rawMap, regions, settings),
  }))
  const scale = poolArcScale(groups.map(g => g.input))
  return new Map(
    groups.map(({ key, input }) => [
      key,
      arcsToRegionMap(resolveArcs(input.pendingArcs, scale, settings), regions),
    ]),
  )
}
