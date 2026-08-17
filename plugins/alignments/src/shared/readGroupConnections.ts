import {
  connectionEndpointBps,
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'

import type { WorkerPileupData } from '../RenderAlignmentDataRPC/types.ts'
import type { ReadKey } from './readIdentity.ts'

// Minimal entry shape both the arc and bezier paths satisfy: a per-read array
// bundle plus the read's index into it. Structural, and deliberately not
// exported — each consumer's own entry type satisfies it by having those two
// fields, so nothing has to import a shape to be accepted here.
interface MinEntry {
  data: WorkerPileupData
  readIdx: number
}

// The QNAME grouping that produces the lists every rule below consumes lives in
// the two CONSUMERS, not here, and that is measured rather than accidental — see
// REJECTED_IDEAS, "One shared groupReadsByName". Both loops are eight lines
// keying on `readNames[i]`; what differs is the entry each builds, and every
// mechanism for varying that (a spread, a factory callback) costs 1.4-1.9x on a
// 200k-read path this sits on. The accessors below ARE shared, which is where
// the duplication that actually mattered was.

export interface ReadConnection<E> {
  e1: E
  e2: E
  // A split-read junction within a single read (consecutive SA segments) vs the
  // mate link between the two reads of a pair. Drives endpoint selection and
  // coloring: split junctions carry no pair orientation / template length.
  isSplit: boolean
}

export interface ConnectionEndpoints {
  bp1: number
  s1: number
  bp2: number
  s2: number
}

// Per-entry field accessors. Every read field lives in a parallel TypedArray
// indexed by `readIdx` — and `readPositions` is the one with a stride of 2 — so
// naming the reads once keeps that arithmetic in a single place.
//
// EXPORTED, and that is the point: both consumers of `resolveReadGroup` used to
// carry a private second set over the identical arrays (`entryFlags`,
// `entryStrand`, `entrySpan` in features/arcs), each with its own spelling of
// the `* 2` / `* 2 + 1` stride — the arcs copy carrying a comment about keeping
// that arithmetic in one place while being the second place it was written.
export function clipAt(e: MinEntry) {
  return e.data.readClipAtStart?.[e.readIdx] ?? 0
}

// Not exported: only `dedupeByReadId` below wants it. The KEY, not the id
// string — this is identity within one fetch, which is exactly what a key is.
function readKeyOfEntry(e: MinEntry) {
  return e.data.readKeys[e.readIdx]!
}

export function flagsOf(e: MinEntry) {
  return e.data.readFlags[e.readIdx]!
}

export function strandOf(e: MinEntry) {
  return e.data.readStrands[e.readIdx]!
}

// Whether this read's MATE is on another chromosome — the worker's own
// `buildReadInterchrom`, which compares RNEXT against the region's refName. A
// boolean here rather than the raw 0/1, matching the flag predicates below.
//
// The entry types on this path deliberately carry no refName (the bezier
// overlay's comment says why), so this array is how a connection asks the
// question at all — and it is the same array the read fill's `interchrom`
// bucket reads, which is what keeps a translocation one colour across the two
// vocabularies instead of two.
export function interchromOf(e: MinEntry) {
  return e.data.readInterchrom[e.readIdx] === 1
}

// `{start, end}` rather than a tuple: it is destructured by name at every call
// site but one, and a positional pair of same-typed genomic coordinates is the
// shape that silently survives being swapped.
export function spanOf(e: MinEntry) {
  return {
    start: e.data.readPositions[e.readIdx * 2]!,
    end: e.data.readPositions[e.readIdx * 2 + 1]!,
  }
}

// Named flag predicates, so the partition below reads as the rule it implements
// rather than as bitmask arithmetic. Each returns a boolean, not the masked bit.
function isSupplementary(e: MinEntry) {
  return (flagsOf(e) & SAM_FLAG_SUPPLEMENTARY) !== 0
}

function isSecondary(e: MinEntry) {
  return (flagsOf(e) & SAM_FLAG_SECONDARY) !== 0
}

function isPaired(e: MinEntry) {
  return (flagsOf(e) & SAM_FLAG_PAIRED) !== 0
}

function isFirstInPair(e: MinEntry) {
  return (flagsOf(e) & SAM_FLAG_FIRST_IN_PAIR) !== 0
}

// The two absolute-bp endpoints (+ strands) of a resolved connection, reading
// the strands/positions off the entry bundle and delegating to the shared
// `connectionEndpointBps` rule (see @jbrowse/cigar-utils).
export function connectionEndpoints<E extends MinEntry>({
  e1,
  e2,
  isSplit,
}: ReadConnection<E>): ConnectionEndpoints {
  const s1 = strandOf(e1)
  const s2 = strandOf(e2)
  const { start: start1, end: end1 } = spanOf(e1)
  const { start: start2, end: end2 } = spanOf(e2)
  const { bp1, bp2 } = connectionEndpointBps({
    s1,
    start1,
    end1,
    s2,
    start2,
    end2,
    isSplit,
  })
  return { bp1, s1, bp2, s2 }
}

// Order one read's segments along the read (5'→3', by clip-at-start-of-read,
// which getClip already makes strand-correct) and emit a split junction between
// each consecutive pair. Genomic order ≠ read order for inversions, so the sort
// is what makes a fwd→rev junction chain the right two segments.
function splitJunctions<E extends MinEntry>(segs: E[]): ReadConnection<E>[] {
  const ordered = [...segs].sort((a, b) => clipAt(a) - clipAt(b))
  const out: ReadConnection<E>[] = []
  for (let j = 0; j < ordered.length - 1; j++) {
    out.push({ e1: ordered[j]!, e2: ordered[j + 1]!, isSplit: true })
  }
  return out
}

// The primary (non-supplementary) segment carries the read's pair orientation /
// template length, so the mate link sources its color from it. Falls back to
// the first-listed segment if no primary is on screen.
function primaryOf<E extends MinEntry>(segs: E[]) {
  return segs.find(e => !isSupplementary(e)) ?? segs[0]!
}

// Which endpoint of a resolved MATE LINK its PAIR-LEVEL fields (orientation,
// template length) are read off. Geometry always comes from the two segments
// actually drawn; these two do not, because they describe the fragment rather
// than the segment, and a supplementary's own record answers them differently.
//
// `pair_orientation` is derived (in @gmod/bam) from the record's own reverse bit
// and its own position, so a supplementary that flipped strand at the split
// junction — or that simply sits on the other side of its mate — computes a
// different orientation from its primary, while the two PRIMARIES of a pair
// always agree (the table maps read1's and read2's flag/position combinations
// onto the same string). Preferring a primary is therefore a no-op whenever both
// are on screen, which is the overwhelming majority, and only bites in the case
// it exists for: a mate whose primary is off-screen, so `primaryOf` above handed
// the resolver its supplementary segment instead.
//
// The same rule the read FILLS already follow — `buildChainResultFields` exists
// to overwrite a supplementary's `readPairOrientations` entry with the chain
// primary's, "rather than the divergent one their own strand-flipped record
// computes". Both connection renderers read that array, so in chain mode they
// were already getting the corrected value and in pileup mode they were not: the
// same reads, the same locus, a different colour depending on a layout setting.
//
// Lives here, beside the resolver that chose the two entries, because the arc
// band and the bezier overlay each need it and a second copy is how the two came
// to disagree in the first place.
export function pairFieldEntry<E extends MinEntry>(e1: E, e2: E) {
  return isSupplementary(e1) && !isSupplementary(e2) ? e2 : e1
}

// The same physical read overlapping two displayedRegions (e.g. spanning
// collapsed-intron exons) is returned by each region's fetch, arriving as
// duplicate entries sharing a read key (the record id, stable across fetches).
// Collapse them, else the copies look like a 2-segment split read and
// splitJunctions fabricates a self-junction. Genuine split segments and mates
// are distinct records with distinct keys, so they survive.
function dedupeByReadId<E extends MinEntry>(entries: E[]) {
  const byId = new Map<ReadKey, E>()
  for (const e of entries) {
    const id = readKeyOfEntry(e)
    if (!byId.has(id)) {
      byId.set(id, e)
    }
  }
  return [...byId.values()]
}

// Dedup a QNAME group by readId, drop the alignments that never take part in a
// connection, then split the survivors into first/second-in-pair sub-reads.
//   - filter: secondary alignments are alternate mappings, not split segments,
//     so they never chain. Mate-unmapped reads are NOT filtered here: an
//     unmapped mate has no position and is never fetched alongside this read, so
//     the only same-name members are this read's own primary + supplementary
//     segments — dropping them would delete a legitimate split junction, and the
//     both-sides-present guard in resolveReadGroup already blocks a dangling
//     mate link when the second mate is absent.
//   - partition: everything lands in `first` when the group is unpaired.
// Used only by resolveReadGroup below, which both the mate-link resolver and the
// arc path's SA-augmented chaining route through, so both agree on which
// segments belong to which mate. It is also the ONLY answer to "are both mates
// on screen?" — an entry count can't tell two mates from one mate's two split
// segments.
function partitionReadGroup<E extends MinEntry>(entries: E[]) {
  const filtered = dedupeByReadId(entries).filter(e => !isSecondary(e))
  const hasPaired = filtered.some(isPaired)
  const first: E[] = []
  const second: E[] = []
  for (const e of filtered) {
    if (!hasPaired || isFirstInPair(e)) {
      first.push(e)
    } else {
      second.push(e)
    }
  }
  return { first, second, hasPaired }
}

// The shape every connection renderer shares: chain each mate's own segments in
// read order (`chainMate`), then link the two mates' primaries (`mateLink`) when
// both mates are present, or hand the one present mate to `loneMateLink` when
// only one is. Generic over the produced element `T` so the bezier overlay
// (ReadConnection) and the coverage arcs (PendingArc) route through one skeleton
// and can't drift on which segments join. Each caller supplies its own per-mate
// chainer: the bezier path chains only the on-screen segments
// (`splitJunctions`), the arc path additionally walks off-screen SA segments.
//
// `loneMateLink` defaults to emitting nothing, which is what a renderer drawing
// between two on-screen reads has to do — it has no second endpoint. The arc
// path overrides it because RNEXT/PNEXT locate the absent mate, so it CAN draw
// that link. Routing it through here rather than through an entry-count branch
// at the call site is what keeps the link from vanishing when the read happens
// to have a second on-screen segment of its own (a split read): counting raw
// entries can't tell "both mates present" from "one mate, two segments".
export function resolveReadGroup<E extends MinEntry, T>(
  entries: E[],
  {
    chainMate,
    mateLink,
    loneMateLink = () => [],
  }: {
    chainMate: (segs: E[]) => T[]
    mateLink: (primary1: E, primary2: E) => T
    loneMateLink?: (primary: E) => T[]
  },
): T[] {
  const { first, second, hasPaired } = partitionReadGroup(entries)
  // Accumulated INTO the first chainer's return value, so `chainMate` must hand
  // back an array it does not keep — all three callers build a fresh one per
  // call. Written this way rather than as a copy because this runs once per
  // QNAME group at depth; the cost of the contract is this comment.
  const out = chainMate(first)
  if (hasPaired) {
    out.push(...chainMate(second))
    if (first.length > 0 && second.length > 0) {
      out.push(mateLink(primaryOf(first), primaryOf(second)))
    } else {
      // `hasPaired` guarantees a survivor, so exactly one side is populated.
      out.push(...loneMateLink(primaryOf(first.length > 0 ? first : second)))
    }
  }
  return out
}

// Resolve a QNAME group (≥2 on-screen alignments sharing a read name) into the
// connections to draw, unifying paired and split-read semantics: each mate's
// on-screen split junctions (in read order) plus one mate link between the two
// mates' primaries. A paired read that is itself SA-split therefore gets both
// its within-read junctions and the mate link; an unpaired long read is a single
// sub-read whose consecutive segments are split junctions. Secondary alignments
// are dropped upstream; supplementary alignments are kept — they are the split
// segments.
export function readGroupConnections<E extends MinEntry>(
  entries: E[],
): ReadConnection<E>[] {
  return resolveReadGroup(entries, {
    chainMate: splitJunctions,
    mateLink: (e1, e2) => ({ e1, e2, isSplit: false }),
  })
}
