import {
  cumBpInEntry,
  findRegionEntry,
  makeStringDict,
  renameDictLane,
} from '@jbrowse/synteny-core'

import type { BpRegionIndex } from '@jbrowse/synteny-core'

// The alignments anchored in a fetch whose mate lands on a contig the facing
// view is not displaying: counted per contig, and placed on the axis they do
// have so something can be drawn where they are. `counts` includes the
// alignments the placed lanes have no entry for, since a block can fall
// outside every displayed region of its own refName and still go somewhere.
export interface OffscreenMateData {
  mateRefNameDict: string[]
  // per dict id
  counts: Uint32Array
  // per placed alignment: its span on this axis in cumBp, clamped to the
  // displayed region
  starts: Float64Array
  ends: Float64Array
  mateRefNameIds: Uint32Array
  // the block's own bp length before the clamp, which is what the
  // `minAlignmentLength` cull reads, as the ribbons' `alignmentLengths` does
  lengths: Float32Array
  // where it lands on the contig it names, in that contig's own bp: there is
  // no ruler on this side to make a cumBp against
  mateStarts: Float64Array
  mateEnds: Float64Array
}

// A collector rather than a second pass, so a whole-genome PAF does not hold
// one object per dropped alignment until the loop ends
export function createOffscreenMateCollector(queryIndex: BpRegionIndex) {
  const mateRefNameDict = makeStringDict()
  const counts: number[] = []
  const starts: number[] = []
  const ends: number[] = []
  const mateRefNameIds: number[] = []
  const lengths: number[] = []
  const mateStarts: number[] = []
  const mateEnds: number[] = []

  return {
    add(
      refName: string,
      start: number,
      end: number,
      mateRefName: string,
      mateStart: number,
      mateEnd: number,
    ) {
      const id = mateRefNameDict.idFor(mateRefName)
      counts[id] = (counts[id] ?? 0) + 1
      const lo = Math.min(start, end)
      const hi = Math.max(start, end)
      const entry = findRegionEntry(queryIndex, refName, lo, hi)
      if (entry) {
        const a = cumBpInEntry(entry, lo)
        const b = cumBpInEntry(entry, hi)
        starts.push(Math.min(a, b))
        ends.push(Math.max(a, b))
        mateRefNameIds.push(id)
        lengths.push(hi - lo)
        mateStarts.push(Math.min(mateStart, mateEnd))
        mateEnds.push(Math.max(mateStart, mateEnd))
      }
    },
    finish(): OffscreenMateData {
      return {
        mateRefNameDict: mateRefNameDict.dict,
        counts: Uint32Array.from(counts),
        starts: Float64Array.from(starts),
        ends: Float64Array.from(ends),
        mateRefNameIds: Uint32Array.from(mateRefNameIds),
        lengths: Float32Array.from(lengths),
        mateStarts: Float64Array.from(mateStarts),
        mateEnds: Float64Array.from(mateEnds),
      }
    },
  }
}

// Rewrite the mate contig names out of the adapter's namespace into the
// assembly's canonical one. These name contigs nobody requested, so they
// arrive spelled the way the file spells them (REFNAME_NAMESPACES.md). The
// two lanes take opposite resolvers: `offscreenMates` names target-axis
// contigs and `targetOffscreenMates` names query-axis ones. `counts` is one
// entry per contig, so a collapse sums it where the per-feature lane
// reindexes.
export function renameOffscreenMates(
  data: OffscreenMateData,
  canonical: (refName: string) => string,
): OffscreenMateData {
  const { dict, ids, remap } = renameDictLane({
    dict: data.mateRefNameDict,
    ids: data.mateRefNameIds,
    canonical,
  })
  if (dict.length === data.mateRefNameDict.length) {
    return { ...data, mateRefNameDict: dict }
  }
  const counts = new Uint32Array(dict.length)
  for (let i = 0; i < remap.length; i++) {
    const to = remap[i]!
    counts[to] = counts[to]! + (data.counts[i] ?? 0)
  }
  return { ...data, mateRefNameDict: dict, mateRefNameIds: ids, counts }
}
