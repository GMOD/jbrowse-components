import {
  SAM_FLAG_MATE_REVERSE,
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_PAIRED,
  splitInversion,
} from '@jbrowse/alignments-core'
import {
  featurizeSA,
  readLeadingBp,
  readTrailingBp,
} from '@jbrowse/cigar-utils'

import {
  connectionEndpoints,
  readGroupConnections,
} from '../../shared/readGroupConnections.ts'

import type { ArcsUploadData } from './types.ts'
import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
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
// samplot read-cloud flat line at Y=|tlen|; the split variant is drawn dashed
// (matching samplot.py's plot_split_plan dotted-line style).
export const ARC_SHAPE_FLAT = 1
export const ARC_SHAPE_FLAT_SPLIT = 2

// Both flat variants (solid samplot line + dashed split line) plot as a
// horizontal line with endpoint-square markers, unlike the curved ARC shape.
export function isFlatArcShape(shape: number) {
  return shape === ARC_SHAPE_FLAT || shape === ARC_SHAPE_FLAT_SPLIT
}

// Matches samplot.py --jitter const default (0.08). Applied multiplicatively
// to |tlen| so lines at the same insert size are visually separated.
const SAMPLOT_JITTER_BOUNDS = 0.08

interface RegionInfo {
  refName: string
  start: number
  end: number
  displayedRegionIndex: number
}

interface ArcSettings {
  colorByType: ArcColorByType
  // samplot (read cloud) mode: flat lines at Y=|tlen|, concordant FR pairs
  // filtered out so only discordant pairs remain. Coloring follows colorByType
  // (same palette as arcs), not a separate DEL/DUP/INV scheme.
  samplot?: boolean
  drawInter: boolean
  drawLongRange: boolean
}

// Pairs at least this far apart paint with the dedicated long-insert color
// (purely a coloring threshold — it has no effect on the arc's geometry).
const LARGE_INSERT_THRESHOLD = 10_000
const LONG_RANGE_STDDEV_THRESHOLD = 3

interface InsertSizeStats {
  upper: number
  lower: number
}

// A pair is concordant FR (the modal, "normal" insert) when its tlen sits
// inside the insert-size stats band AND it is LR orientation. Samplot drops
// these to surface SV signals (mirrors samplot.py's --max_depth 1 default).
function isConcordantFRPair(
  pairOrientationNum: number | undefined,
  tlen: number | undefined,
  stats: InsertSizeStats | undefined,
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
//   3=RR (R1R2,R2R1), 4=FF (F1F2,F2F1).
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

function insertSizeColor(tlen: number, stats: InsertSizeStats | undefined) {
  const abs = Math.abs(tlen)
  return stats && abs > stats.upper
    ? COLOR_LONG_INSERT
    : stats && abs < stats.lower
      ? COLOR_SHORT_INSERT
      : COLOR_DEFAULT
}

// Same-chromosome color classifier (interchromosomal ticks are colored
// separately, always COLOR_INTERCHROM). Read cloud (samplot) shares this so its
// flat lines color the same as arcs — red/green/teal/navy by insert size +
// orientation.
function getArcColorType(args: {
  colorByType: ArcColorByType
  hasPaired: boolean
  isSplit: boolean
  longRange: boolean
  largeInsert: boolean
  pairOrientationNum: number
  tlen: number
  p1Strand: number
  p2Strand: number
  stats: InsertSizeStats | undefined
}) {
  const {
    colorByType,
    hasPaired,
    isSplit,
    longRange,
    largeInsert,
    pairOrientationNum,
    tlen,
    p1Strand,
    p2Strand,
    stats,
  } = args

  // A split-read junction carries no pair semantics (no template length, no
  // pair orientation), so it colors by its own segment strands — opposite
  // strands flag the inversion — regardless of whether OTHER reads in the view
  // are paired. Keying on the per-connection `isSplit` instead of the dataset-
  // global `hasPaired` is what lets a paired read that is itself SA-split show
  // its inversion junctions correctly. Resolved before the long-/large-insert
  // override below because that is a paired-insert concept: a wide inversion
  // breakpoint (large genomic gap) must keep its inversion color, not get
  // repainted long-insert just because its span clears the pair thresholds.
  if (!hasPaired || isSplit) {
    return colorByType === 'insertSize'
      ? COLOR_DEFAULT
      : unpairedOrientationColor(p1Strand, p2Strand)
  }
  // Long-range, large-insert pairs always paint as long-insert.
  if (longRange && largeInsert) {
    return COLOR_LONG_INSERT
  }
  const orient = orientationColor(pairOrientationNum)
  const insert = insertSizeColor(tlen, stats)
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

interface PendingArc {
  p1Ref: string
  p1Bp: number
  p1Strand: number
  p2Ref: string
  p2Bp: number
  p2Strand: number
  pairOrientationNum: number | undefined
  tlen: number | undefined
  isSplit: boolean
}

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
// Samplot: flat line at Y=|tlen| with ±8% multiplicative jitter so coincident
// reads separate visually. Otherwise it's the single curved ARC shape (the
// renderer chooses dome vs vertical-lines by zoom); Y is the genomic radius.
function computeArcShape({
  samplot,
  isSplit,
  absrad,
  tlen,
  p1Bp,
  p2Bp,
}: {
  samplot: boolean
  isSplit: boolean
  absrad: number
  tlen: number | undefined
  p1Bp: number
  p2Bp: number
}) {
  if (samplot) {
    const baseY = tlen !== undefined ? Math.abs(tlen) : absrad
    const jitter =
      1 + SAMPLOT_JITTER_BOUNDS * (pairJitter01(p1Bp, p2Bp) * 2 - 1)
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
  let stats: InsertSizeStats | undefined
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

// A lone read whose mate is mapped elsewhere: connect its near endpoint to the
// recorded mate position.
function mateArc(entry: ReadEntry): PendingArc {
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
    p2Ref: mateRef || refName,
    p2Bp: data.readNextPositions?.[readIdx] ?? 0,
    p2Strand: flags & SAM_FLAG_MATE_REVERSE ? -1 : 1,
    pairOrientationNum: data.readPairOrientations[readIdx]!,
    tlen: data.readInsertSizes[readIdx],
    isSplit: false,
  }
}

// A lone read carrying an SA tag: chain primary → supplementary blocks in true
// read order (sorted by clip-at-start-of-read), connecting each segment's
// read-trailing edge to the next segment's read-leading edge. Strand-correct so
// fwd→rev / rev→fwd inversion junctions join at the breakpoint rather than the
// far edge of the reverse segment.
function splitArcsFromSA(entry: ReadEntry): PendingArc[] {
  const { data, readIdx, refName } = entry
  const allAlns: SegAln[] = [
    {
      refName,
      start: data.readPositions[readIdx * 2]!,
      end: data.readPositions[readIdx * 2 + 1]!,
      strand: data.readStrands[readIdx]!,
      clipAtStart: data.readClipAtStart?.[readIdx] ?? 0,
    },
    ...featurizeSA(
      data.readSuppAlignments?.[readIdx],
      data.readIds[readIdx]!,
      data.readStrands[readIdx],
      data.readNames[readIdx],
    )
      // Drop truncated / placeholder-CIGAR / non-numeric-position SA entries —
      // they parse to a zero-length or NaN span and would emit a junk arc.
      .filter(sa => Number.isFinite(sa.start) && sa.end > sa.start)
      .map(sa => ({
        refName: sa.refName,
        start: sa.start,
        end: sa.end,
        strand: sa.strand,
        clipAtStart: sa.clipLengthAtStartOfRead,
      })),
  ].sort((a, b) => a.clipAtStart - b.clipAtStart)
  const arcs: PendingArc[] = []
  for (let j = 0; j < allAlns.length - 1; j++) {
    const a1 = allAlns[j]!
    const a2 = allAlns[j + 1]!
    arcs.push({
      p1Ref: a1.refName,
      p1Bp: readTrailingBp(a1.strand, a1.start, a1.end),
      p1Strand: a1.strand,
      p2Ref: a2.refName,
      p2Bp: readLeadingBp(a2.strand, a2.start, a2.end),
      p2Strand: a2.strand,
      pairOrientationNum: undefined,
      tlen: undefined,
      isSplit: true,
    })
  }
  return arcs
}

// Build a pending arc from one resolved connection. Split junctions carry no
// template length / pair orientation (so samplot draws a dashed line at the gap
// span rather than collapsing |0| to the baseline); the mate link sources both
// from its first read's primary. Endpoints: a split junction joins the first
// segment's read-trailing (3') edge to the next segment's read-leading (5')
// edge — the inversion breakpoint, not the far edge of the reverse segment — and
// the mate link joins each read's 3' end.
function pendingArcFromConnection(c: ReadConnection<ReadEntry>): PendingArc {
  const { e1, e2, isSplit } = c
  const { bp1, s1, bp2, s2 } = connectionEndpoints(c)
  return {
    p1Ref: e1.refName,
    p1Bp: bp1,
    p1Strand: s1,
    p2Ref: e2.refName,
    p2Bp: bp2,
    p2Strand: s2,
    pairOrientationNum: isSplit
      ? undefined
      : e1.data.readPairOrientations[e1.readIdx],
    tlen: isSplit ? undefined : e1.data.readInsertSizes[e1.readIdx],
    isSplit,
  }
}

function collectPendingArcs(
  readsByName: Map<string, ReadEntry[]>,
  drawLongRange: boolean,
) {
  const pendingArcs: PendingArc[] = []
  for (const entries of readsByName.values()) {
    if (entries.length === 1) {
      // A lone read connects to an off-screen mate / supplementary block — only
      // drawn when long-range connections are enabled. The two link kinds are
      // independent read properties, so a read gets BOTH: its mate link (when
      // paired with a mapped mate) AND its SA split junctions (when it carries
      // supplementary alignments). splitArcsFromSA emits nothing without an SA
      // tag, so an ordinary paired read still draws just the one mate arc. This
      // mirrors the multi-entry path, which likewise chains a read's SA
      // junctions and adds the mate link.
      if (drawLongRange) {
        const entry = entries[0]!
        const flags = entry.data.readFlags[entry.readIdx]!
        const isMateMapped =
          !!(flags & SAM_FLAG_PAIRED) && !(flags & SAM_FLAG_MATE_UNMAPPED)
        if (isMateMapped) {
          pendingArcs.push(mateArc(entry))
        }
        pendingArcs.push(...splitArcsFromSA(entry))
      }
    } else {
      // ≥2 on-screen alignments sharing a name: resolve into per-mate split
      // junctions + the mate link (handles paired reads that are themselves
      // SA-split), then materialize each as an arc.
      pendingArcs.push(
        ...readGroupConnections(entries).map(pendingArcFromConnection),
      )
    }
  }
  return pendingArcs
}

export function computeArcsFromPileupData(
  rpcDataMap: ReadonlyMap<number, PileupDataResult>,
  regions: RegionInfo[],
  settings: ArcSettings,
) {
  const { colorByType, samplot = false, drawInter, drawLongRange } = settings
  const readsByName = groupReadsByName(rpcDataMap, regions)
  const { hasPaired, stats } = computePairingInfo(rpcDataMap)
  const pendingArcs = collectPendingArcs(readsByName, drawLongRange)

  const longRangeThreshold = computeLongRangeThreshold(pendingArcs)

  const arcs: ComputedArc[] = []
  const lines: ComputedLine[] = []

  for (const {
    p1Ref,
    p1Bp,
    p1Strand,
    p2Ref,
    p2Bp,
    p2Strand,
    pairOrientationNum,
    tlen,
    isSplit,
  } of pendingArcs) {
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

    // Samplot suppresses the modal-insert FR pairs so SV signals stand out.
    if (samplot && isConcordantFRPair(pairOrientationNum, tlen, stats)) {
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
      colorByType,
      hasPaired,
      isSplit,
      longRange,
      largeInsert,
      pairOrientationNum: pairOrientationNum ?? 0,
      tlen: tlen ?? 0,
      p1Strand,
      p2Strand,
      stats,
    })
    const { shapeType, yBp } = computeArcShape({
      samplot,
      isSplit,
      absrad,
      tlen,
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
