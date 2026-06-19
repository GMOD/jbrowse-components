import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/alignments-core'

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

function clipAt(e: MinEntry) {
  return e.data.readClipAtStart?.[e.readIdx] ?? 0
}

function flagsOf(e: MinEntry) {
  return e.data.readFlags[e.readIdx]!
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
  const filtered = entries.filter(e => {
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
