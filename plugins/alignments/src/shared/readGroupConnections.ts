import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/alignments-core'
import { readLeadingBp, readTrailingBp } from '@jbrowse/cigar-utils'

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

// The two absolute-bp endpoints (+ strands) of a resolved connection — the
// single endpoint rule shared by the arc and linked-read paths. The first
// endpoint is always its segment's read-trailing (3') edge. The second is the
// next segment's read-leading (5') edge for a split junction (so a fwd→rev
// inversion lands on the breakpoint, not the far edge of the reverse segment),
// or the mate's read-trailing (3') edge for a pair.
export function connectionEndpoints<E extends MinEntry>({
  e1,
  e2,
  isSplit,
}: ReadConnection<E>): ConnectionEndpoints {
  const s1 = strandOf(e1)
  const s2 = strandOf(e2)
  const [start1, end1] = startEndOf(e1)
  const [start2, end2] = startEndOf(e2)
  return {
    bp1: readTrailingBp(s1, start1, end1),
    s1,
    bp2: isSplit
      ? readLeadingBp(s2, start2, end2)
      : readTrailingBp(s2, start2, end2),
    s2,
  }
}

// Order one read's segments along the read (5'→3', by clip-at-start-of-read,
// which getClip already makes strand-correct) and emit a split junction between
// each consecutive pair. Genomic order ≠ read order for inversions, so the sort
// is what makes a fwd→rev junction chain the right two segments.
function chainSubRead<E extends MinEntry>(segs: E[], out: ReadConnection<E>[]) {
  segs.sort((a, b) => clipAt(a) - clipAt(b))
  for (let j = 0; j < segs.length - 1; j++) {
    out.push({ e1: segs[j]!, e2: segs[j + 1]!, isSplit: true })
  }
}

// The primary (non-supplementary) segment carries the read's pair orientation /
// template length, so the mate link sources its color from it. Falls back to
// the read-order-first segment if no primary is on screen.
function primaryOf<E extends MinEntry>(segs: E[]) {
  return segs.find(e => !(flagsOf(e) & SAM_FLAG_SUPPLEMENTARY)) ?? segs[0]!
}

// Resolve a QNAME group (≥2 on-screen alignments sharing a read name) into the
// connections to draw, unifying paired and split-read semantics:
//   - paired: partition into first/second-in-pair sub-reads, chain each sub-
//     read's split junctions in read order, then one mate link between the two
//     sub-reads' primaries. A paired read that is itself SA-split therefore
//     gets both its within-read junctions and the mate link.
//   - unpaired (long read): a single sub-read whose consecutive segments are
//     split junctions.
// Secondary alignments are always dropped; paired entries with an unmapped mate
// are dropped (they would create spurious links). Supplementary alignments are
// kept — they are the split segments.
export function readGroupConnections<E extends MinEntry>(
  entries: E[],
): ReadConnection<E>[] {
  // The same physical read overlapping two displayedRegions (e.g. a read
  // spanning collapsed-intron exons) is returned by each region's fetch, so it
  // arrives as duplicate entries sharing a readId (f.id() = adapter.id +
  // fileOffset, stable across fetches). Collapse them first, else the copies
  // look like a 2-segment split read and chainSubRead fabricates a self-
  // junction. Genuine split segments and mates are distinct records with
  // distinct ids, so they survive.
  const byId = new Map<string, E>()
  for (const e of entries) {
    const id = readIdOf(e)
    if (!byId.has(id)) {
      byId.set(id, e)
    }
  }
  const filtered = [...byId.values()].filter(e => {
    const f = flagsOf(e)
    const paired = !!(f & SAM_FLAG_PAIRED)
    return !(f & SAM_FLAG_SECONDARY) && !(paired && f & SAM_FLAG_MATE_UNMAPPED)
  })

  const out: ReadConnection<E>[] = []
  const hasPaired = filtered.some(e => flagsOf(e) & SAM_FLAG_PAIRED)
  if (hasPaired) {
    const first: E[] = []
    const second: E[] = []
    for (const e of filtered) {
      if (flagsOf(e) & SAM_FLAG_FIRST_IN_PAIR) {
        first.push(e)
      } else {
        second.push(e)
      }
    }
    chainSubRead(first, out)
    chainSubRead(second, out)
    if (first.length > 0 && second.length > 0) {
      out.push({ e1: primaryOf(first), e2: primaryOf(second), isSplit: false })
    }
  } else {
    chainSubRead([...filtered], out)
  }
  return out
}
