import {
  cumBpInEntry,
  findRegionEntry,
  makeStringDict,
} from '@jbrowse/synteny-core'

import type { BpRegionIndex } from '@jbrowse/synteny-core'

/**
 * The alignments anchored in this fetch whose mate lands on a contig the facing
 * view is not displaying — counted per contig, and placed on the query axis so
 * something can be drawn where they are.
 *
 * A synteny band draws a ribbon only when BOTH ends land on a displayed region,
 * so today a locus syntenic to a contig you did not stack looks exactly like a
 * locus syntenic to nothing. On the `grape_peach_cacao` demo, peach chr1 over
 * grape chr1 draws 1029 of its 3796 anchors and says nothing about the other
 * 2767. See `agent-docs/ideas/offscreen-synteny-mates.md`.
 *
 * `counts` is per contig and INCLUDES the alignments `starts`/`ends` has no
 * entry for, which is what makes it answerable as "how much is this view not
 * showing you". The placed ones are a subset by construction: a block can fall
 * outside every displayed region of its own refName and still be an alignment
 * that goes somewhere.
 */
export interface OffscreenMateData {
  // the contigs the facing view is not displaying, in id order
  mateRefNameDict: string[]
  // per dict id: how many alignments here point at that contig
  counts: Uint32Array
  // per PLACED alignment: its span on the query axis in cumBp, and which contig
  // it points at
  starts: Float64Array
  ends: Float64Array
  mateRefNameIds: Uint32Array
  // per PLACED alignment: the block's OWN bp length, before the clamp below.
  // The `minAlignmentLength` cull reads this rather than `ends - starts`, for
  // the same reason the ribbons' `alignmentLengths` is taken off the original
  // block extent: a block straddling a displayed region's edge is clamped to
  // the part in view, and culling on the clamped span hides a mark whose ribbon
  // the same setting keeps.
  lengths: Float32Array
}

/**
 * Accumulate the off-screen mates as the decorate loop meets them.
 *
 * A COLLECTOR RATHER THAN A SECOND PASS, because the alternative is one object
 * per dropped alignment held until the loop ends — and the dropped set is
 * unbounded in the same way the kept set is, so a whole-genome PAF would
 * allocate millions of them to throw away. Everything here appends a number.
 *
 * The query axis only. These have no mate axis to be placed on; that is what
 * they are.
 */
export function createOffscreenMateCollector(queryIndex: BpRegionIndex) {
  const mateRefNameDict = makeStringDict()
  const counts: number[] = []
  const starts: number[] = []
  const ends: number[] = []
  const mateRefNameIds: number[] = []
  const lengths: number[] = []

  return {
    add(refName: string, start: number, end: number, mateRefName: string) {
      const id = mateRefNameDict.idFor(mateRefName)
      counts[id] = (counts[id] ?? 0) + 1
      const lo = Math.min(start, end)
      const hi = Math.max(start, end)
      const entry = findRegionEntry(queryIndex, refName, lo, hi)
      if (!entry) {
        return
      }
      // clamped to the region, like a ribbon's own corners: a block straddling
      // the edge is drawn as the part in view rather than dropped
      const a = cumBpInEntry(entry, lo)
      const b = cumBpInEntry(entry, hi)
      starts.push(Math.min(a, b))
      ends.push(Math.max(a, b))
      mateRefNameIds.push(id)
      lengths.push(hi - lo)
    },
    finish(): OffscreenMateData {
      return {
        mateRefNameDict: mateRefNameDict.dict,
        counts: Uint32Array.from(counts),
        starts: Float64Array.from(starts),
        ends: Float64Array.from(ends),
        mateRefNameIds: Uint32Array.from(mateRefNameIds),
        lengths: Float32Array.from(lengths),
      }
    },
  }
}

/**
 * The per-contig tally, largest first — what a reader is shown, and what names
 * the rows worth offering to add.
 *
 * Built on the main thread off the transferred lanes rather than shipped as
 * objects: `counts` is one entry per contig, so the sort is over a scaffold
 * count and not a feature count.
 */
export function offscreenMateTally(data: OffscreenMateData) {
  return data.mateRefNameDict
    .map((refName, id) => ({ refName, count: data.counts[id] ?? 0 }))
    .filter(entry => entry.count > 0)
    .sort((a, b) => b.count - a.count || (a.refName < b.refName ? -1 : 1))
}
