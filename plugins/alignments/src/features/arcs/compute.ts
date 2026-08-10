import {
  SAM_FLAG_MATE_REVERSE,
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_PAIRED,
  splitJunctionKind,
} from '@jbrowse/alignments-core'
import {
  connectionEndpointBps,
  featurizeSA,
  readLeadingBp,
} from '@jbrowse/cigar-utils'

import { ARC_COLOR_SHORT_INSERT } from '../../LinearAlignmentsDisplay/shaders/palettes.ts'
import {
  classifyInsertSize,
  robustSpread,
} from '../../shared/insertSizeStats.ts'
import { resolveReadGroup } from '../../shared/readGroupConnections.ts'
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
  // Normalize a raw BAM refName (from an SA tag or RNEXT — which use the file's
  // own naming, e.g. `chr1`) to the assembly-canonical refName the fetched
  // reads carry (e.g. `1`). Without this a split junction between a fetched
  // read (`1`) and its SA segment (`chr1`) reads as inter-chromosomal and paints
  // as a connector tick instead of the intra-chromosomal split-inversion arc.
  // Optional: omitted (tests / no assembly) means no aliasing — identity.
  canonicalRefName?: (refName: string) => string
}

// Pairs at least this far apart paint with the dedicated long-insert color
// (purely a coloring threshold — it has no effect on the arc's geometry).
const LARGE_INSERT_THRESHOLD = 10_000
const LONG_RANGE_STDDEV_THRESHOLD = 3

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
// The shader's own slot number: arcMarkerColorByIndex overrides exactly this
// index with the pale pileup fill, and the Canvas2D marker palette overrides the
// same one. A local `2` here agreed with them by inspection only.
const COLOR_SHORT_INSERT = ARC_COLOR_SHORT_INSERT
const COLOR_INTERCHROM = 3
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

// Legend category for a read-cloud endpoint-square color slot. The read
// legend is otherwise driven purely by read-fill categories (readColorCategory),
// so cloud-only buckets — split junctions especially, which no read fill
// produces outside chain mode — would be missing. Mapping the arc color slots
// back to legend categories fills that gap, and by construction each square's
// color equals its category swatch: COLOR_SHORT_INSERT paints the pale
// colorShortInsert (arcMarkerColorPalette / arcMarkerColorByIndex), matching the
// 'shortInsert' swatch, and the split slots reuse the split-junction swatches.
// The default slot is the baseline colorPairLR; its label follows the coloring
// mode ('Normal' insert vs. 'LR' orientation, both colorPairLR).
export function arcColorLegendCategory(
  colorType: number,
  colorByType: ArcColorByType,
): ReadColorCategory {
  switch (colorType) {
    case COLOR_LONG_INSERT:
      return 'longInsert'
    case COLOR_SHORT_INSERT:
      return 'shortInsert'
    case COLOR_INTERCHROM:
      return 'interchrom'
    case COLOR_PAIR_LL:
      return 'pairLL'
    case COLOR_PAIR_RR:
      return 'pairRR'
    case COLOR_PAIR_RL:
      return 'pairRL'
    case COLOR_SPLIT_INVERSION:
      return 'splitInversion'
    case COLOR_SPLIT_DELETION:
      return 'splitDeletion'
    default:
      return colorByType === 'orientation' ? 'pairLR' : 'normalInsert'
  }
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
function getArcColorType(args: {
  arc: PendingArc
  colorByType: ArcColorByType
  hasPaired: boolean
  longRange: boolean
  largeInsert: boolean
  stats: InsertSizeBand | undefined
}) {
  const { arc, colorByType, hasPaired, longRange, largeInsert, stats } = args

  // A split-read junction carries no pair semantics (no template length, no
  // pair orientation), so it colors by its own segment strands — opposite
  // strands flag the inversion — regardless of whether OTHER reads in the view
  // are paired. Keying on the per-connection `isSplit` instead of the dataset-
  // global `hasPaired` is what lets a paired read that is itself SA-split show
  // its inversion junctions correctly. Resolved before the long-/large-insert
  // override below because that is a paired-insert concept: a wide inversion
  // breakpoint (large genomic gap) must keep its inversion color, not get
  // repainted long-insert just because its span clears the pair thresholds.
  if (!hasPaired || arc.isSplit) {
    return colorByType === 'insertSize'
      ? COLOR_DEFAULT
      : unpairedOrientationColor(arc.p1Strand, arc.p2Strand)
  }
  const orient = orientationColor(arc.pairOrientationNum)
  // A genomically far-apart pair reads as long-insert even when its TLEN-based
  // class is normal — discordant pairs often carry an unreliable/0 TLEN, so the
  // span is the more trustworthy signal. Folded into the insert class (and, in
  // pure 'orientation' mode, applied only as the LR fallback) rather than as a
  // blanket pre-switch override, so it can't repaint an abnormal-orientation
  // pair (RL/RR/LL) whose orientation is the real SV signal — the same
  // protection the split branch above relies on.
  const isLongRange = longRange && largeInsert
  const longRangeColor = isLongRange ? COLOR_LONG_INSERT : COLOR_DEFAULT
  const insert = isLongRange
    ? COLOR_LONG_INSERT
    : insertSizeColor(arc.tlen, stats)
  switch (colorByType) {
    case 'insertSize':
      return insert
    case 'orientation':
      return orient ?? longRangeColor
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
}

export interface ComputedLine {
  x: ArcEndpoint
  colorType: number
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
function pairJitter01(p1Bp: number, p2Bp: number) {
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
    }
  }
  return { shapeType: ARC_SHAPE_ARC, yBp: absrad }
}

// Takes one array per group, not one flat array: the threshold describes the
// whole fetched read set, so every group's arcs contribute to it (see
// `poolArcScale`). Iterated rather than flattened so pooling costs no copy.
function computeLongRangeThreshold(pendingArcsByGroup: PendingArc[][]) {
  // Split-junction spans are breakpoint gaps, not paired-end insert radii;
  // mixing them into the distribution skews the spread and mis-classifies the
  // long-insert coloring. Characterize the threshold from mate-link arcs only.
  const radii: number[] = []
  for (const arcs of pendingArcsByGroup) {
    for (const a of arcs) {
      if (!a.isSplit && a.p1Ref === a.p2Ref) {
        radii.push(Math.abs(a.p2Bp - a.p1Bp) / 2)
      }
    }
  }
  if (radii.length === 0) {
    return Infinity
  }
  // Robust center + spread (median ± N·1.4826·MAD): arc radii are right-skewed
  // like insert sizes, so a few very large inserts would inflate a mean/std
  // threshold and let genuine long-range pairs escape the long-insert override.
  const { center, spread } = robustSpread(radii, LONG_RANGE_STDDEV_THRESHOLD)
  return center + spread
}

interface ReadEntry {
  displayedRegionIndex: number
  refName: string
  readIdx: number
  data: PileupDataResult
}

// Per-entry field accessors. Every read field lives in a parallel TypedArray
// indexed by `readIdx` — and `readPositions` is the one with a stride of 2 — so
// naming the reads once keeps the `* 2` / `* 2 + 1` arithmetic in a single place
// instead of re-spelled at each of the five sites that need a span.
function entryFlags(e: ReadEntry) {
  return e.data.readFlags[e.readIdx]!
}

function entryStrand(e: ReadEntry) {
  return e.data.readStrands[e.readIdx]!
}

function entrySpan(e: ReadEntry) {
  return {
    start: e.data.readPositions[e.readIdx * 2]!,
    end: e.data.readPositions[e.readIdx * 2 + 1]!,
  }
}

// Bucket every fetched read by its QNAME so mates / split segments that share a
// name (possibly across displayed regions) land in the same list.
function groupReadsByName(
  rpcDataMap: ReadonlyMap<number, PileupDataResult>,
  regions: RegionInfo[],
) {
  const readsByName = new Map<string, ReadEntry[]>()
  for (const region of regions) {
    const data = rpcDataMap.get(region.displayedRegionIndex)
    if (data) {
      for (let i = 0; i < data.readIds.length; i++) {
        getOrCreate(readsByName, data.readNames[i]!, () => []).push({
          displayedRegionIndex: region.displayedRegionIndex,
          refName: region.refName,
          readIdx: i,
          data,
        })
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
      for (let i = 0; i < data.readIds.length; i++) {
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

// Dependencies threaded through pending-arc collection: the long-range gate and
// the assembly refName normalizer. `canonicalRefName` maps a raw BAM refName
// (SA tag / RNEXT — the file's own naming, e.g. `chr1`) to the assembly-
// canonical name the fetched reads carry (e.g. `1`). Bundled so the whole chain
// tree threads one value; keeping every SegAln/PendingArc refName canonical is
// what stops a same-chr split junction from reading as inter-chromosomal.
interface ArcChainContext {
  drawLongRange: boolean
  canonicalRefName: (refName: string) => string
}

function entrySeg(entry: ReadEntry): SegAln {
  return {
    refName: entry.refName,
    ...entrySpan(entry),
    strand: entryStrand(entry),
    clipAtStart: entry.data.readClipAtStart?.[entry.readIdx] ?? 0,
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
function saSegments(entry: ReadEntry, ctx: ArcChainContext): SegAln[] {
  const { data, readIdx } = entry
  return featurizeSA(
    data.readSuppAlignments?.[readIdx],
    data.readIds[readIdx]!,
    data.readStrands[readIdx],
    data.readNames[readIdx],
  )
    .filter(sa => Number.isFinite(sa.start) && sa.end > sa.start)
    .map(sa => ({
      refName: ctx.canonicalRefName(sa.refName),
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
function unpairedReadChain(
  entries: ReadEntry[],
  ctx: ArcChainContext,
): SegAln[] {
  const byPos = new Map<string, SegAln>()
  // On-screen segments first, so a segment described by BOTH a fetched record
  // and a sibling's SA tag keeps the on-screen record (first writer wins).
  for (const seg of [
    ...entries.map(entrySeg),
    ...entries.flatMap(e => saSegments(e, ctx)),
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
  canonicalRefName?: (refName: string) => string,
): SegAln[][] {
  const ctx: ArcChainContext = {
    // Not the user's off-screen-mate setting: a derivative path is exactly the
    // thing whose segments leave the current view, so the SA walk always runs.
    // It gates arc EMISSION, and this builds no arcs.
    drawLongRange: true,
    canonicalRefName: canonicalRefName ?? (refName => refName),
  }
  const chains: SegAln[][] = []
  for (const entries of groupReadsByName(rpcDataMap, regions).values()) {
    chains.push(
      ...resolveReadGroup<ReadEntry, SegAln[]>(entries, {
        chainMate: segs => [unpairedReadChain(segs, ctx)],
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
// an off-screen segment is a long-range connection, drawn only when those are
// enabled — this is also what suppresses a misleading direct join across an
// off-screen segment (the flanking pair are not actually read-adjacent).
function unpairedChainArcs(
  entries: ReadEntry[],
  ctx: ArcChainContext,
): PendingArc[] {
  const chain = unpairedReadChain(entries, ctx)
  const arcs: PendingArc[] = []
  for (let j = 0; j < chain.length - 1; j++) {
    const a1 = chain[j]!
    const a2 = chain[j + 1]!
    if ((a1.onScreen && a2.onScreen) || ctx.drawLongRange) {
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
  const { start, end } = entrySpan(entry)
  return readLeadingBp(entryStrand(entry), start, end)
}

// The mate link between the two reads of one pair, sourcing orientation and
// template length from the first read's primary.
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
  return {
    p1Ref: e1.refName,
    p1Bp: pairOuterBp(e1),
    p1Strand: entryStrand(e1),
    p2Ref: e2.refName,
    p2Bp: pairOuterBp(e2),
    p2Strand: entryStrand(e2),
    isSplit: false,
    pairOrientationNum: e1.data.readPairOrientations[e1.readIdx]!,
    tlen: e1.data.readInsertSizes[e1.readIdx]!,
  }
}

// The link to a mate that isn't on screen: only RNEXT/PNEXT locate it, so this
// is the one connection kind the bezier overlay can't draw and the arc path can.
// Gated on `drawLongRange` (the "show off-screen mate connections" setting) and
// on the mate actually having a locus — an unmapped mate has none, and neither
// does a record that claims a mapped mate while naming RNEXT `*` / PNEXT 0
// (BAM next_refid -1). Substituting this read's own refName and bp 0 there drew
// a full-chromosome arc down to the origin.
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
  const mateRef = data.readNextRefs?.[readIdx]
  const mateBp = data.readNextPositions?.[readIdx]
  const mateUnmapped = (entryFlags(entry) & SAM_FLAG_MATE_UNMAPPED) !== 0
  if (!ctx.drawLongRange || mateUnmapped || !mateRef || !mateBp) {
    return []
  }
  const strand = entryStrand(entry)
  const { start, end } = entrySpan(entry)
  return [
    {
      p1Ref: refName,
      p1Bp: readLeadingBp(strand, start, end),
      p1Strand: strand,
      p2Ref: ctx.canonicalRefName(mateRef),
      p2Bp: mateBp,
      p2Strand: entryFlags(entry) & SAM_FLAG_MATE_REVERSE ? -1 : 1,
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
  longRangeThreshold: number
}

function poolArcScale(inputs: ArcInputs[]): ArcScale {
  return {
    hasPaired: inputs.some(i => i.hasPaired),
    stats: inputs.find(i => i.stats !== undefined)?.stats,
    longRangeThreshold: computeLongRangeThreshold(
      inputs.map(i => i.pendingArcs),
    ),
  }
}

// Colour + shape one group's resolved connections against the pooled scale.
function resolveArcs(
  pendingArcs: PendingArc[],
  { hasPaired, stats, longRangeThreshold }: ArcScale,
  settings: ArcSettings,
) {
  const { colorByType, cloud = false, drawInter } = settings
  const arcs: ComputedArc[] = []
  const lines: ComputedLine[] = []

  for (const arc of pendingArcs) {
    const { p1Ref, p1Bp, p2Ref, p2Bp } = arc
    // Interchromosomal: never an arc — drop a tick on each endpoint, always
    // painted the single dedicated interchromosomal color. Insert size,
    // long-range distance, and pair orientation are all meaningless across refs
    // (a cross-chromosome "pair orientation" is arbitrary), so coloring by them
    // just produces visual noise — every translocation tick is one uniform
    // color regardless of colorByType.
    if (p1Ref !== p2Ref) {
      if (drawInter) {
        lines.push(
          { x: { refName: p1Ref, bp: p1Bp }, colorType: COLOR_INTERCHROM },
          { x: { refName: p2Ref, bp: p2Bp }, colorType: COLOR_INTERCHROM },
        )
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
    const longRange = absrad >= longRangeThreshold
    const largeInsert = absrad > LARGE_INSERT_THRESHOLD

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
      longRange,
      largeInsert,
      stats,
    })
    const { shapeType, yBp } = computeArcShape({ cloud, arc, absrad })

    arcs.push({
      p1: { refName: p1Ref, bp: p1Bp },
      p2: { refName: p2Ref, bp: p2Bp },
      colorType,
      shapeType,
      yBp,
    })
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
export function groupArcsByRef(arcs: ComputedArc[], lines: ComputedLine[]) {
  return {
    arcsByRef: bucketByRef(arcs, arc => arc.p1.refName),
    linesByRef: bucketByRef(lines, line => line.x.refName),
  }
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

  let numFlatArcs = 0
  let maxFlatArcYBp = 0
  for (let i = 0; i < regionArcs.length; i++) {
    const arc = regionArcs[i]!
    arcX1[i] = arc.p1.bp
    arcX2[i] = arc.p2.bp
    arcColorTypes[i] = arc.colorType
    arcShapeTypes[i] = arc.shapeType
    arcYBp[i] = arc.yBp
    if (isFlatArcShape(arc.shapeType)) {
      numFlatArcs++
      if (arc.yBp > maxFlatArcYBp) {
        maxFlatArcYBp = arc.yBp
      }
    }
  }

  // One entry per connector tick — the arcLine pass self-expands each instance
  // to the two band-edge vertices (see arcLine.slang / packInstances).
  const arcLinePositions = new Uint32Array(regionLines.length)
  const arcLineColorTypes = new Uint8Array(regionLines.length)
  for (let i = 0; i < regionLines.length; i++) {
    const line = regionLines[i]!
    arcLinePositions[i] = line.x.bp
    arcLineColorTypes[i] = line.colorType
  }

  return {
    arcX1,
    arcX2,
    arcColorTypes,
    arcShapeTypes,
    arcYBp,
    numArcs: regionArcs.length,
    numFlatArcs,
    maxFlatArcYBp,
    arcLinePositions,
    arcLineColorTypes,
    numArcLines: regionLines.length,
  }
}

// Bucket one group's computed arcs by refName, then materialize each region's
// `ArcsUploadData`.
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
        arcsByRef.get(ri.refName) ?? [],
        linesByRef.get(ri.refName) ?? [],
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
