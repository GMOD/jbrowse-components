import {
  cumBpInEntry,
  findRegionEntry,
  makeStringDict,
  renameDictLane,
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
  // per PLACED alignment: where it lands on the contig it names, in that
  // contig's OWN bp. Not a cumBp: the facing row is not displaying that contig,
  // so there is no ruler on this side to make one against — which is the whole
  // reason a click on a mark used to navigate to a bare refName and land on a
  // whole chromosome.
  mateStarts: Float64Array
  mateEnds: Float64Array
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
      mateStarts.push(Math.min(mateStart, mateEnd))
      mateEnds.push(Math.max(mateStart, mateEnd))
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

/**
 * Rewrite the mate contig names out of the adapter's namespace into the
 * assembly's canonical one.
 *
 * THE SAME CLASS AS `mateRefNameDict`, and it was the one lane of it left
 * adapter-space: these name contigs nobody requested — that is the definition of
 * an off-screen mate — so they arrive spelled the way the file spells them,
 * while everything they meet is canonical. A strip then labelled its marks `1`
 * against an assembly calling that contig `chr1`, the hamburger item and the
 * hover tally counted the two spellings as two contigs, and the click ran
 * `navToLocString` on a name the row's assembly might not know at all.
 * `agent-docs/reference/REFNAME_NAMESPACES.md` is the rule.
 *
 * WHICH RESOLVER IS THE WHOLE QUESTION, and the two lanes take opposite ones:
 * `offscreenMates` holds mate contigs of the TARGET axis and
 * `targetOffscreenMates` holds mate contigs of the QUERY axis. See the call
 * site in `LinearSyntenyDisplay/afterAttach`.
 *
 * `counts` is keyed by dictionary id like `mateRefNameIds` is, but it is one
 * entry per contig rather than one per alignment, so a collapse SUMS it where
 * the per-feature lane reindexes. Both go through `renameDictLane`'s `remap`.
 */
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
