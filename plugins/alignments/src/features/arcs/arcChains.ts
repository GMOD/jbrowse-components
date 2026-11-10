import {
  clipAt,
  flagsOf,
  interchromOf,
  pairFieldEntry,
  primaryOf,
  resolveReadGroup,
  spanOf,
  strandOf,
  readIdAt,
  readNameAt,
} from '@jbrowse/alignments-core'
import {
  connectionEndpointBps,
  featurizeSA,
  readLeadingBp,
  readTrailingBodyDir,
  SAM_FLAG_MATE_REVERSE,
  SAM_FLAG_MATE_UNMAPPED,
} from '@jbrowse/cigar-utils'
import { adapterRefName } from '@jbrowse/core/util'

import { isMatePlacedRead, isPlacedRead } from '../../shared/placedReads.ts'
import { nextRefAt } from '../../shared/readNextRefs.ts'
import { getOrCreate } from '../../shared/util.ts'
import { MATE_CLIP_UNKNOWN } from './arcTypes.ts'

import type { WorkerPileupData } from '../../RenderAlignmentDataRPC/types.ts'
import type { InsertSizeBand } from '../../shared/insertSizeStats.ts'
import type {
  ArcChainContext,
  CanonicalRefName,
  PairedPendingArc,
  PendingArc,
  ReadEntry,
  RegionInfo,
  SegAln,
} from './arcTypes.ts'

// Reads in, pending arcs out: grouping by QNAME, walking a read's SA segments
// into a chain, and emitting one pending arc per junction or mate link, in
// genomic bp with no color, shape or region partitioning.

// Bucket every fetched read by QNAME so mates and split segments, possibly in
// different regions, share a list. Walks the regions so an unfetched one drops
// out. The connector mark has a twin of this loop; sharing them was measured
// slower. A nameless feature (a PAF/synteny block) is skipped, or every block
// in view would become one read.
export function groupReadsByName(
  rpcDataMap: ReadonlyMap<number, WorkerPileupData>,
  regions: RegionInfo[],
  groupKey: string,
  readsByName = new Map<string, ReadEntry[]>(),
) {
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
            groupKey,
          })
        }
      }
    }
  }
  return readsByName
}

// The same bucketing over every lane at once, each entry stamped with its
// lane, so `collectPendingArcsByLane` emits each junction once.
export function groupLaneReadsByName(
  lanes: Iterable<readonly [string, ReadonlyMap<number, WorkerPileupData>]>,
  regions: RegionInfo[],
) {
  const readsByName = new Map<string, ReadEntry[]>()
  for (const [groupKey, rpcDataMap] of lanes) {
    groupReadsByName(rpcDataMap, regions, groupKey, readsByName)
  }
  return readsByName
}

export function insertSizeStatsOf(
  rpcDataMap: ReadonlyMap<number, WorkerPileupData>,
): InsertSizeBand | undefined {
  return [...rpcDataMap.values()].find(data => data.insertSizeStats)
    ?.insertSizeStats
}

// Whether a connection whose far end is not loaded in this view is emitted:
// either category asks for it, since the menu offers them as siblings and a
// single-chromosome view never loads a translocation's far mate. Both still
// filter in `resolveArcs`, so this cannot bypass an exclusion.
export function emitsOffScreenPartner(
  { filter }: ArcChainContext,
  interchromosomal: boolean,
) {
  return (
    filter.offscreenMates !== 'exclude' ||
    (filter.interchrom !== 'exclude' && interchromosomal)
  )
}

function entrySeg(entry: ReadEntry): SegAln {
  return {
    refName: entry.refName,
    ...spanOf(entry),
    strand: strandOf(entry),
    clipAtStart: clipAt(entry),
    onScreen: true,
    placed: isPlacedRead(entry),
  }
}

// Identity of a segment within one read, which collapses a fetched segment and
// its SA-tag twin. The clip at start of read is part of it, so passes of a read
// over one locus (circles, tandem repeats) stay apart. Sound only because every
// SegAln refName is canonical and `readPositions` carries the read's true,
// unclipped start (split-read-chains.md section 4).
function segLocusKey(seg: SegAln) {
  return `${seg.refName}:${seg.start}:${seg.clipAtStart}`
}

// The off-screen segments one entry's SA tag names, canonical-refName'd.
// Truncated / placeholder-CIGAR / non-numeric-position SA records parse to a
// zero-length or NaN span and would emit a junk arc, so they're dropped here.
function saSegments(
  entry: ReadEntry,
  canonicalRefName: CanonicalRefName,
): SegAln[] {
  const { data, readIdx } = entry
  const sa = data.readSuppAlignments?.[readIdx]
  if (!sa) {
    return []
  }
  return featurizeSA(
    sa,
    readIdAt(data, readIdx)!,
    data.readStrands[readIdx],
    readNameAt(data, readIdx),
  )
    .filter(sa => Number.isFinite(sa.start) && sa.end > sa.start)
    .map(sa => ({
      refName: canonicalRefName(adapterRefName(sa.refName)),
      start: sa.start,
      end: sa.end,
      strand: sa.strand,
      clipAtStart: sa.clipLengthAtStartOfRead,
      onScreen: false,
      placed: sa.mapq !== 0,
    }))
}

// The read's complete segment chain: every fetched segment plus any segment
// named only in a sibling's SA tag, deduplicated by `segLocusKey` and sorted
// into read order by clip at start of read. What every consumer of a chain owes
// is `agent-docs/mechanisms/split-read-chains.md`. `entries` arrives deduped and
// without secondaries (`resolveReadGroup`). Takes only the normalizer: the SA
// walk always runs, and the filters decide only which junctions are drawn.
export function unpairedReadChain(
  entries: ReadEntry[],
  canonicalRefName: CanonicalRefName,
): SegAln[] {
  const byPos = new Map<string, SegAln>()
  // On-screen segments first, so a segment also named by an SA tag keeps its
  // fetched record.
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

// The junction between two read-adjacent segments: the first's read-trailing
// (3') edge joined to the next's read-leading (5') edge, so an inversion lands
// on the breakpoint rather than the far edge of the reverse segment.
function splitJunctionArc(
  a1: SegAln,
  a2: SegAln,
  offScreen: boolean,
): PendingArc {
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
    offScreen,
  }
}

// Junctions along an unpaired read's chain. One between two on-screen
// segments always draws; one touching an off-screen segment is emitted on
// `emitsOffScreenPartner`, which also suppresses a direct join across a hidden
// segment. An interchromosomal junction needs both pieces placed (ADR-229).
function unpairedChainArcs(
  entries: ReadEntry[],
  ctx: ArcChainContext,
): PendingArc[] {
  const chain = unpairedReadChain(entries, ctx.canonicalRefName)
  const arcs: PendingArc[] = []
  for (let j = 0; j < chain.length - 1; j++) {
    const a1 = chain[j]!
    const a2 = chain[j + 1]!
    const offScreen = !a1.onScreen || !a2.onScreen
    const interchromosomal = a1.refName !== a2.refName
    if (
      (!interchromosomal || (a1.placed && a2.placed)) &&
      (!offScreen || emitsOffScreenPartner(ctx, interchromosomal))
    ) {
      arcs.push(splitJunctionArc(a1, a2, offScreen))
    }
  }
  return arcs
}

// A mate's own outer (5', read-leading) edge, the fragment boundary TLEN is
// measured from. Not `connectionEndpointBps`' facing-gap edges, which would
// understate a mate link's span by both reads' lengths and disagree with the
// TLEN that colors it.
export function pairOuterBp(entry: ReadEntry) {
  const { start, end } = spanOf(entry)
  return readLeadingBp(strandOf(entry), start, end)
}

// The foot direction for `pairOuterBp`'s edge: the read's own direction
// negated (`readTrailingBodyDir`), not the `readLeadingBodyDir` that mirrors
// the bp. A foot names the arm the junction keeps, measured from the junction.
// A split junction's endpoint is the junction, so there the arm and the
// segment's body are one ray; a mate link's endpoint is the fragment's outer
// edge, from which the read's body points back at the junction, the opposite
// ray. Using the read's own direction makes an FR pair draw inward
// (duplication) feet while a split read over the same junction draws outward.
// `arcBreakendFeet.test.ts` pins the two families against each other.
export function pairOuterDir(entry: ReadEntry) {
  return readTrailingBodyDir(strandOf(entry))
}

// The mate link between the two reads of one pair, with orientation, TLEN and
// flags from the primary `pairFieldEntry` picks, and each end at its read's
// outer edge (`pairOuterBp`). Split junctions go through `splitJunctionArc`.
export function mateLinkArc(e1: ReadEntry, e2: ReadEntry): PairedPendingArc {
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
    interchrom: interchromOf(src),
    // Off the same primary as the orientation and tlen, not `e1`, which may be
    // a supplementary.
    flags: flagsOf(src),
    stats: src.data.insertSizeStats,
    offScreen: false,
    p1Clip: clipAt(e1),
    p2Clip: clipAt(e2),
  }
}

// The link to a mate that isn't on screen, located only by RNEXT/PNEXT, gated
// on `emitsOffScreenPartner` and on the mate having a locus. An unmapped mate
// has none, nor does PNEXT 0 ("unavailable"), which would draw an arc to the
// origin. `readNextPositions` stores absent as 0, so a mate at a contig's first
// base also draws nothing; separating them would touch extraction,
// `buildReadInterchrom` and the tooltip, and is not worth it. RNEXT `*` is
// already undefined from `nextRefAt`.
//
// Only PNEXT is known off-screen, not the mate's CIGAR, so the far endpoint is
// the mate's leftmost base: off by up to a read length, negligible at arc zoom.
export function offScreenMateArcs(
  entry: ReadEntry,
  ctx: ArcChainContext,
): PairedPendingArc[] {
  const { data, readIdx, refName } = entry
  const mateRef = nextRefAt(data, readIdx)
  const mateBp = data.readNextPositions?.[readIdx]
  const mateUnmapped = (flagsOf(entry) & SAM_FLAG_MATE_UNMAPPED) !== 0
  if (mateUnmapped || !mateRef || !mateBp) {
    return []
  }
  // Normalized before the comparison, or every aliased mate reads as a
  // translocation.
  const mateCanonRef = ctx.canonicalRefName(mateRef)
  const interchromosomal = mateCanonRef !== refName
  if (
    !emitsOffScreenPartner(ctx, interchromosomal) ||
    (interchromosomal && !(isPlacedRead(entry) && isMatePlacedRead(entry)))
  ) {
    return []
  }
  const strand = strandOf(entry)
  const mateStrand = flagsOf(entry) & SAM_FLAG_MATE_REVERSE ? -1 : 1
  return [
    {
      p1Ref: refName,
      // The same fragment-outer edge and foot as `mateLinkArc` (`pairOuterDir`).
      p1Bp: pairOuterBp(entry),
      p1Strand: strand,
      p1Dir: pairOuterDir(entry),
      p2Ref: mateCanonRef,
      p2Bp: mateBp,
      p2Strand: mateStrand,
      // Carries the same read-length approximation as `p2Bp`; omitting it would
      // lose the orientation, all an interchromosomal pair's mark has to say.
      p2Dir: readTrailingBodyDir(mateStrand),
      pairOrientationNum: data.readPairOrientations[readIdx]!,
      tlen: data.readInsertSizes[readIdx]!,
      interchrom: interchromOf(entry),
      flags: flagsOf(entry),
      stats: data.insertSizeStats,
      isSplit: false,
      offScreen: true,
      p1Clip: clipAt(entry),
      p2Clip: MATE_CLIP_UNKNOWN,
    },
  ]
}

// A pending arc and the display lane it is drawn in.
interface LanePendingArc {
  groupKey: string
  arc: PendingArc
}

// A lane's pending arcs and, parallel to them, the QNAME each came from: the
// key the connectors over the pileup look up a connection's floor verdict by.
export interface LaneArcs {
  arcs: PendingArc[]
  names: string[]
}

/**
 * Every QNAME group's pending arcs, by lane. `resolveReadGroup` is the
 * connector mark's group resolution, with two arc-path hooks: the SA-augmented
 * chainer that steps through an off-screen split segment, and the off-screen
 * mate link only this path draws. Resolved over every lane at once, since a
 * lane holds one segment and reaches the rest through its SA tag, so resolving
 * per lane would emit one junction per lane at a fraction of its support.
 */
export function collectPendingArcsByLane(
  readsByName: Map<string, ReadEntry[]>,
  ctx: ArcChainContext,
) {
  const byLane = new Map<string, LaneArcs>()
  for (const [name, entries] of readsByName) {
    const laned = resolveReadGroup<ReadEntry, LanePendingArc>(entries, {
      // The fragment's primary's lane, not the segment's: an inverted
      // supplementary lands in a different lane from its primary.
      chainMate: segs => {
        const arcs = unpairedChainArcs(segs, ctx)
        const groupKey = arcs.length > 0 ? primaryOf(segs).groupKey : ''
        return arcs.map(arc => ({ groupKey, arc }))
      },
      // The lane of the entry the orientation and TLEN come from.
      mateLink: (e1, e2) => {
        const arc = mateLinkArc(e1, e2)
        const crosses = arc.interchrom || e1.refName !== e2.refName
        return crosses && !(isPlacedRead(e1) && isPlacedRead(e2))
          ? []
          : [{ groupKey: pairFieldEntry(e1, e2).groupKey, arc }]
      },
      loneMateLink: primary =>
        offScreenMateArcs(primary, ctx).map(arc => ({
          groupKey: primary.groupKey,
          arc,
        })),
    })
    for (const { groupKey, arc } of laned) {
      const lane = getOrCreate(byLane, groupKey, () => ({
        arcs: [],
        names: [],
      }))
      lane.arcs.push(arc)
      lane.names.push(name)
    }
  }
  return byLane
}

/**
 * The ungrouped feed: every pending arc of a display drawing one band. Routed
 * through the lane pass so the two cannot drift on which segments join — with
 * one lane every entry carries the same key, so the single bucket comes back in
 * the order the reads produced it.
 */
export function collectPendingArcs(
  readsByName: Map<string, ReadEntry[]>,
  ctx: ArcChainContext,
) {
  return [...collectPendingArcsByLane(readsByName, ctx).values()].flatMap(
    lane => lane.arcs,
  )
}
