import {
  connectionEndpointBps,
  featurizeSA,
  readLeadingBp,
  readTrailingBodyDir,
  SAM_FLAG_MATE_REVERSE,
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_PAIRED,
} from '@jbrowse/cigar-utils'

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

// Reads in, PENDING arcs out: grouping by QNAME, walking a read's SA segments
// into a chain, and emitting one pending arc per junction or mate link.

// Everything here works in genomic bp on records alone — no colour, no shape,
// no region partitioning. `compute.ts` takes it from `collectPendingArcs`.

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
export function groupReadsByName(
  rpcDataMap: ReadonlyMap<number, WorkerPileupData>,
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

export function computePairingInfo(
  rpcDataMap: ReadonlyMap<number, WorkerPileupData>,
) {
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
export function emitsOffScreenPartner(
  ctx: ArcChainContext,
  interchromosomal: boolean,
) {
  return ctx.drawLongRange || (ctx.drawInter && interchromosomal)
}

export function entrySeg(entry: ReadEntry): SegAln {
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
export function segLocusKey(seg: SegAln) {
  return `${seg.refName}:${seg.start}`
}

// The off-screen segments one entry's SA tag names, canonical-refName'd.
// Truncated / placeholder-CIGAR / non-numeric-position SA records parse to a
// zero-length or NaN span and would emit a junk arc, so they're dropped here.
export function saSegments(
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
export function unpairedReadChain(
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
  rpcDataMap: ReadonlyMap<number, WorkerPileupData>,
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
export function splitJunctionArc(a1: SegAln, a2: SegAln): PendingArc {
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
export function unpairedChainArcs(
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
export function pairOuterBp(entry: ReadEntry) {
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
export function pairOuterDir(entry: ReadEntry) {
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
export function offScreenMateArcs(
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
export function collectPendingArcs(
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
