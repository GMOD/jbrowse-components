import {
  SAM_FLAG_MATE_REVERSE,
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECONDARY,
  splitInversion,
} from '@jbrowse/alignments-core'
import {
  connectionEndpointBps,
  featurizeSA,
  readTrailingBp,
} from '@jbrowse/cigar-utils'

import { classifyInsertSize } from '../../shared/insertSizeStats.ts'
import {
  connectionEndpoints,
  partitionReadGroup,
  primaryOf,
} from '../../shared/readGroupConnections.ts'

import type { ArcsUploadData } from './types.ts'
import type { ReadColorCategory } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { InsertSizeBand } from '../../shared/insertSizeStats.ts'
import type { ReadConnection } from '../../shared/readGroupConnections.ts'
import type { ArcColorByType } from '../../shared/types.ts'

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
function isConcordantFRPair(
  pairOrientationNum: number | undefined,
  tlen: number | undefined,
  stats: InsertSizeBand | undefined,
) {
  if (pairOrientationNum !== 1 || tlen === undefined || stats === undefined) {
    return false
  }
  const abs = Math.abs(tlen)
  return abs >= stats.lower && abs <= stats.upper
}

// Color-slot indices into the arc palette. Kept as named constants so the
// classifier reads as a story rather than as magic numbers.
const COLOR_DEFAULT = 0
const COLOR_LONG_INSERT = 1
const COLOR_SHORT_INSERT = 2
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

// A split junction (or unpaired-read segment pairing): opposite strands → the
// magenta inversion color; same strands (both known) → the yellow deletion
// color; unknown → default. Matches the split-read fill + connector colors.
function unpairedOrientationColor(p1Strand: number, p2Strand: number) {
  return splitInversion(p1Strand, p2Strand) !== undefined
    ? COLOR_SPLIT_INVERSION
    : p1Strand !== 0 && p2Strand !== 0
      ? COLOR_SPLIT_DELETION
      : COLOR_DEFAULT
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
  // Long-range, large-insert pairs always paint as long-insert.
  if (longRange && largeInsert) {
    return COLOR_LONG_INSERT
  }
  const orient = orientationColor(arc.pairOrientationNum)
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

interface SegAln {
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
// mislabeled at half its real size). Otherwise it's the single curved ARC shape
// (the renderer chooses dome vs vertical-lines by zoom); Y is the genomic radius.
function computeArcShape({
  cloud,
  isSplit,
  absrad,
  tlen,
  p1Bp,
  p2Bp,
}: {
  cloud: boolean
  isSplit: boolean
  absrad: number
  tlen: number | undefined
  p1Bp: number
  p2Bp: number
}) {
  if (cloud) {
    const baseY = tlen !== undefined ? Math.abs(tlen) : Math.abs(p2Bp - p1Bp)
    const jitter = 1 + CLOUD_JITTER_BOUNDS * (pairJitter01(p1Bp, p2Bp) * 2 - 1)
    return {
      shapeType: isSplit ? ARC_SHAPE_FLAT_SPLIT : ARC_SHAPE_FLAT,
      yBp: Math.round(baseY * jitter),
    }
  }
  return { shapeType: ARC_SHAPE_ARC, yBp: absrad }
}

function computeLongRangeThreshold(pendingArcs: PendingArc[]) {
  // Split-junction spans are breakpoint gaps, not paired-end insert radii;
  // mixing them into the distribution skews mean + 3·std and mis-classifies the
  // long-insert coloring. Characterize the threshold from mate-link arcs only.
  const radii = pendingArcs
    .filter(a => !a.isSplit && a.p1Ref === a.p2Ref)
    .map(a => Math.abs(a.p2Bp - a.p1Bp) / 2)
  if (radii.length === 0) {
    return Infinity
  }
  const mean = radii.reduce((a, b) => a + b, 0) / radii.length
  const variance = radii.reduce((a, b) => a + (b - mean) ** 2, 0) / radii.length
  const std = Math.sqrt(variance)
  return mean + LONG_RANGE_STDDEV_THRESHOLD * std
}

interface ReadEntry {
  displayedRegionIndex: number
  refName: string
  readIdx: number
  data: PileupDataResult
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
        const name = data.readNames[i]!
        let list = readsByName.get(name)
        if (!list) {
          list = []
          readsByName.set(name, list)
        }
        list.push({
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

// A lone read whose mate is mapped elsewhere: connect its 3' (read-trailing)
// edge to the recorded mate position. Only PNEXT (the mate's leftmost/5' base)
// is known off-screen — the mate's CIGAR/length isn't — so for a forward-strand
// mate the endpoint lands at its 5' edge rather than its true 3' end (off by one
// read length). Negligible at arc-view zoom; exact resolution would need the
// off-screen mate's alignment.
function mateArc(entry: ReadEntry, ctx: ArcChainContext): PendingArc {
  const { data, readIdx, refName } = entry
  const flags = data.readFlags[readIdx]!
  const strand = data.readStrands[readIdx]!
  const start = data.readPositions[readIdx * 2]!
  const end = data.readPositions[readIdx * 2 + 1]!
  const mateRef = data.readNextRefs?.[readIdx] ?? ''
  return {
    p1Ref: refName,
    p1Bp: readTrailingBp(strand, start, end),
    p1Strand: strand,
    p2Ref: mateRef ? ctx.canonicalRefName(mateRef) : refName,
    p2Bp: data.readNextPositions?.[readIdx] ?? 0,
    p2Strand: flags & SAM_FLAG_MATE_REVERSE ? -1 : 1,
    pairOrientationNum: data.readPairOrientations[readIdx]!,
    tlen: data.readInsertSizes[readIdx]!,
    isSplit: false,
  }
}

function entrySeg(entry: ReadEntry): SegAln {
  const { data, readIdx, refName } = entry
  return {
    refName,
    start: data.readPositions[readIdx * 2]!,
    end: data.readPositions[readIdx * 2 + 1]!,
    strand: data.readStrands[readIdx]!,
    clipAtStart: data.readClipAtStart?.[readIdx] ?? 0,
    onScreen: true,
  }
}

// The unpaired read's complete segment chain: every on-screen segment (a fetched
// entry) plus any segment named in a sibling's SA tag that no view currently
// shows. Sorted into read order by clip-at-start-of-read. Every segment's
// refName is canonical — entries already are; SA segments are normalized here —
// so the `${refName}:${start}` dedup collapses a fetched segment and its
// SA-tag twin to one entry (first writer wins, and on-screen segments are added
// first, so the on-screen record survives). That single canonical chain is what
// lets a connector step through an off-screen segment and keeps a same-chr split
// junction from reading as inter-chromosomal.
//
// This dedup requires both sides to agree on `start`, which is why
// readPositions must carry the read's TRUE start (buildBaseReadArrays): a start
// clipped to the region would never match its SA twin's un-clipped one, leaving
// both copies in the chain to be joined as a spurious same-strand "deletion".
function unpairedReadChain(
  entries: ReadEntry[],
  ctx: ArcChainContext,
): SegAln[] {
  const byPos = new Map<string, SegAln>()
  const addSeg = (seg: SegAln) => {
    const key = `${seg.refName}:${seg.start}`
    if (!byPos.has(key)) {
      byPos.set(key, seg)
    }
  }
  for (const entry of entries) {
    // Secondary alignments are alternate mappings, not part of the read's split
    // chain — dropped here as the multi-entry path does.
    if (!(entry.data.readFlags[entry.readIdx]! & SAM_FLAG_SECONDARY)) {
      addSeg(entrySeg(entry))
    }
  }
  for (const { data, readIdx } of entries) {
    for (const sa of featurizeSA(
      data.readSuppAlignments?.[readIdx],
      data.readIds[readIdx]!,
      data.readStrands[readIdx],
      data.readNames[readIdx],
    )) {
      // Drop truncated / placeholder-CIGAR / non-numeric-position SA entries —
      // they parse to a zero-length or NaN span and would emit a junk arc.
      if (Number.isFinite(sa.start) && sa.end > sa.start) {
        addSeg({
          refName: ctx.canonicalRefName(sa.refName),
          start: sa.start,
          end: sa.end,
          strand: sa.strand,
          clipAtStart: sa.clipLengthAtStartOfRead,
          onScreen: false,
        })
      }
    }
  }
  return [...byPos.values()].sort((a, b) => a.clipAtStart - b.clipAtStart)
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
      const { bp1, bp2 } = connectionEndpointBps({
        s1: a1.strand,
        start1: a1.start,
        end1: a1.end,
        s2: a2.strand,
        start2: a2.start,
        end2: a2.end,
        isSplit: true,
      })
      arcs.push({
        p1Ref: a1.refName,
        p1Bp: bp1,
        p1Strand: a1.strand,
        p2Ref: a2.refName,
        p2Bp: bp2,
        p2Strand: a2.strand,
        isSplit: true,
      })
    }
  }
  return arcs
}

// Build a pending arc from one resolved connection. Split junctions carry no
// template length / pair orientation (so read cloud draws a dashed line at the gap
// span rather than collapsing |0| to the baseline); the mate link sources both
// from its first read's primary. Endpoints: a split junction joins the first
// segment's read-trailing (3') edge to the next segment's read-leading (5')
// edge — the inversion breakpoint, not the far edge of the reverse segment — and
// the mate link joins each read's 3' end.
function pendingArcFromConnection(c: ReadConnection<ReadEntry>): PendingArc {
  const { e1, e2, isSplit } = c
  const { bp1, s1, bp2, s2 } = connectionEndpoints(c)
  const endpoints = {
    p1Ref: e1.refName,
    p1Bp: bp1,
    p1Strand: s1,
    p2Ref: e2.refName,
    p2Bp: bp2,
    p2Strand: s2,
  }
  return isSplit
    ? { ...endpoints, isSplit: true }
    : {
        ...endpoints,
        isSplit: false,
        pairOrientationNum: e1.data.readPairOrientations[e1.readIdx]!,
        tlen: e1.data.readInsertSizes[e1.readIdx]!,
      }
}

function collectPendingArcs(
  readsByName: Map<string, ReadEntry[]>,
  ctx: ArcChainContext,
) {
  const pendingArcs: PendingArc[] = []
  for (const entries of readsByName.values()) {
    const anyPaired = entries.some(
      e => e.data.readFlags[e.readIdx]! & SAM_FLAG_PAIRED,
    )
    if (!anyPaired) {
      // Unpaired (long) read: chain its full read-order segment set, stepping
      // through any off-screen segment rather than joining across it. Handles
      // both the lone-read (single on-screen segment, junctions all long-range)
      // and the multi-segment on-screen cases uniformly.
      pendingArcs.push(...unpairedChainArcs(entries, ctx))
    } else if (entries.length === 1) {
      // A lone paired read connects to an off-screen mate / supplementary block —
      // only drawn when long-range connections are enabled. The two link kinds
      // are independent read properties, so it gets BOTH: its mate link (when
      // the mate is mapped) AND its SA split junctions (when it carries
      // supplementary alignments).
      if (ctx.drawLongRange) {
        const entry = entries[0]!
        const flags = entry.data.readFlags[entry.readIdx]!
        // Secondary alignments (0x100) are alternate mappings, not the read's
        // true locus, and carry unset TLEN / pair-orientation — drop them here
        // as every other path does (partitionReadGroup, unpairedReadChain)
        // rather than anchoring a spurious mate link at the secondary locus.
        // They survive the default flag filter (1540 omits 0x100), so a lone
        // on-screen secondary (primary + mate off-screen, e.g. a multimapper)
        // would otherwise reach mateArc.
        if (!(flags & SAM_FLAG_SECONDARY)) {
          if (!(flags & SAM_FLAG_MATE_UNMAPPED)) {
            pendingArcs.push(mateArc(entry, ctx))
          }
          pendingArcs.push(...unpairedChainArcs(entries, ctx))
        }
      }
    } else {
      // ≥2 on-screen paired alignments sharing a name. Partition into first/
      // second-in-pair sub-reads and chain each in read order, stepping through
      // any off-screen SA segment (gated by drawLongRange) exactly as the
      // unpaired path does — so a 3rd, off-screen split segment still gets its
      // junctions instead of being skipped over — then add the single mate link
      // between the two mates' primaries. (readGroupConnections, used by the
      // bezier overlay, only chains the on-screen entries; the SA-tag off-screen
      // walk lives here so it doesn't leak pseudo-entries into that path.)
      const { first, second, hasPaired } = partitionReadGroup(entries)
      pendingArcs.push(...unpairedChainArcs(first, ctx))
      if (hasPaired) {
        pendingArcs.push(...unpairedChainArcs(second, ctx))
        if (first.length > 0 && second.length > 0) {
          pendingArcs.push(
            pendingArcFromConnection({
              e1: primaryOf(first),
              e2: primaryOf(second),
              isSplit: false,
            }),
          )
        }
      }
    }
  }
  return pendingArcs
}

export function computeArcsFromPileupData(
  rpcDataMap: ReadonlyMap<number, PileupDataResult>,
  regions: RegionInfo[],
  settings: ArcSettings,
) {
  const { colorByType, cloud = false, drawInter, drawLongRange } = settings
  const readsByName = groupReadsByName(rpcDataMap, regions)
  const { hasPaired, stats } = computePairingInfo(rpcDataMap)
  const pendingArcs = collectPendingArcs(readsByName, {
    drawLongRange,
    canonicalRefName: settings.canonicalRefName ?? (refName => refName),
  })

  const longRangeThreshold = computeLongRangeThreshold(pendingArcs)

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
    // aren't loaded in the current view; see the single-entry branch above.)
    const colorType = getArcColorType({
      arc,
      colorByType,
      hasPaired,
      longRange,
      largeInsert,
      stats,
    })
    const { shapeType, yBp } = computeArcShape({
      cloud,
      isSplit: arc.isSplit,
      absrad,
      tlen: arc.isSplit ? undefined : arc.tlen,
      p1Bp,
      p2Bp,
    })

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
    const ref = refOf(item)
    let bucket = byRef.get(ref)
    if (!bucket) {
      bucket = []
      byRef.set(ref, bucket)
    }
    bucket.push(item)
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

  let maxFlatArcYBp = 0
  for (let i = 0; i < regionArcs.length; i++) {
    const arc = regionArcs[i]!
    arcX1[i] = arc.p1.bp
    arcX2[i] = arc.p2.bp
    arcColorTypes[i] = arc.colorType
    arcShapeTypes[i] = arc.shapeType
    arcYBp[i] = arc.yBp
    if (isFlatArcShape(arc.shapeType) && arc.yBp > maxFlatArcYBp) {
      maxFlatArcYBp = arc.yBp
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
    maxFlatArcYBp,
    arcLinePositions,
    arcLineColorTypes,
    numArcLines: regionLines.length,
  }
}

// Full per-region arc upload feed for one set of raw pileup data: compute arcs,
// bucket them by refName, then materialize each region's `ArcsUploadData`. This
// is the single arc pipeline — grouped mode runs it once per group, ungrouped
// once for the lone group — so the ungrouped result is exactly the N==1 case of
// the grouped one, byte-identical by construction.
export function computeArcsRegionMap(
  rpcDataMap: ReadonlyMap<number, PileupDataResult>,
  regions: RegionInfo[],
  settings: ArcSettings,
): Map<number, ArcsUploadData> {
  const { arcs, lines } = computeArcsFromPileupData(
    rpcDataMap,
    regions,
    settings,
  )
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
