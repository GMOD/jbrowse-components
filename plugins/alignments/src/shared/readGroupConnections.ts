import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/alignments-core'
import { connectionEndpointBps } from '@jbrowse/cigar-utils'

import type { PileupDataResult } from '../RenderAlignmentDataRPC/types.ts'

// Minimal entry shape both the arc and bezier paths satisfy: a per-read array
// bundle plus the read's index into it.
interface MinEntry {
  data: PileupDataResult
  readIdx: number
}

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

function clipAt(e: MinEntry) {
  return e.data.readClipAtStart?.[e.readIdx] ?? 0
}

function readIdOf(e: MinEntry) {
  return e.data.readIds[e.readIdx]!
}

function flagsOf(e: MinEntry) {
  return e.data.readFlags[e.readIdx]!
}

function strandOf(e: MinEntry) {
  return e.data.readStrands[e.readIdx]!
}

function startEndOf(e: MinEntry) {
  return [
    e.data.readPositions[e.readIdx * 2]!,
    e.data.readPositions[e.readIdx * 2 + 1]!,
  ] as const
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
  const [start1, end1] = startEndOf(e1)
  const [start2, end2] = startEndOf(e2)
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
// the read-order-first segment if no primary is on screen.
function primaryOf<E extends MinEntry>(segs: E[]) {
  return segs.find(e => !(flagsOf(e) & SAM_FLAG_SUPPLEMENTARY)) ?? segs[0]!
}

// Dedup a QNAME group by readId, drop the alignments that never take part in a
// connection, then split the survivors into first/second-in-pair sub-reads.
//   - readId dedup: the same physical read overlapping two displayedRegions
//     (e.g. spanning collapsed-intron exons) is returned by each region's
//     fetch, arriving as duplicate entries sharing a readId (f.id() =
//     adapter.id + fileOffset, stable across fetches). Collapse them, else the
//     copies look like a 2-segment split read and splitJunctions fabricates a
//     self-junction. Genuine split segments and mates are distinct records with
//     distinct ids, so they survive.
//   - filter: secondary alignments are alternate mappings, not split segments,
//     so they never chain. Mate-unmapped reads are NOT filtered here: an
//     unmapped mate has no position and is never fetched alongside this read, so
//     the only same-name members are this read's own primary + supplementary
//     segments — dropping them would delete a legitimate split junction, and the
//     first/second guard in readGroupConnections already blocks a dangling mate
//     link when the second mate is absent.
//   - partition: everything lands in `first` when the group is unpaired.
// Used only by resolveReadGroup below, which both the mate-link resolver and the
// arc path's SA-augmented chaining route through, so both agree on which
// segments belong to which mate.
function partitionReadGroup<E extends MinEntry>(entries: E[]) {
  const byId = new Map<string, E>()
  for (const e of entries) {
    const id = readIdOf(e)
    if (!byId.has(id)) {
      byId.set(id, e)
    }
  }
  const filtered = [...byId.values()].filter(
    e => !(flagsOf(e) & SAM_FLAG_SECONDARY),
  )
  const hasPaired = filtered.some(e => flagsOf(e) & SAM_FLAG_PAIRED)
  const first: E[] = []
  const second: E[] = []
  for (const e of filtered) {
    if (!hasPaired || flagsOf(e) & SAM_FLAG_FIRST_IN_PAIR) {
      first.push(e)
    } else {
      second.push(e)
    }
  }
  return { first, second, hasPaired }
}

// The shape every connection renderer shares: chain each mate's own segments in
// read order (`chainMate`), then link the two mates' primaries (`mateLink`) —
// but only when both mates are actually present, so a lone read (unmapped or
// off-screen mate) never emits a dangling link. Generic over the produced
// element `T` so the bezier overlay (ReadConnection) and the coverage arcs
// (PendingArc) route through one skeleton and can't drift on which segments
// join. Each caller supplies its own per-mate chainer: the bezier path chains
// only the on-screen segments (`splitJunctions`), the arc path additionally
// walks off-screen SA segments.
export function resolveReadGroup<E extends MinEntry, T>(
  entries: E[],
  chainMate: (segs: E[]) => T[],
  mateLink: (primary1: E, primary2: E) => T,
): T[] {
  const { first, second, hasPaired } = partitionReadGroup(entries)
  const out = chainMate(first)
  if (hasPaired) {
    out.push(...chainMate(second))
    if (first.length > 0 && second.length > 0) {
      out.push(mateLink(primaryOf(first), primaryOf(second)))
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
  return resolveReadGroup(entries, splitJunctions, (e1, e2) => ({
    e1,
    e2,
    isSplit: false,
  }))
}
