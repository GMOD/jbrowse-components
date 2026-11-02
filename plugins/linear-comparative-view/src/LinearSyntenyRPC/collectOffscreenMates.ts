import {
  comparativeFilter,
  createAttributeChannels,
  cumBpInEntry,
  findRegionEntry,
  makeStringDict,
  renameDictLane,
  writeFeatureChannels,
} from '@jbrowse/synteny-core'

import type { Feature } from '@jbrowse/core/util'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'
import type {
  AttributeRange,
  BpRegionIndex,
  FilterExtras,
} from '@jbrowse/synteny-core'

// The alignments anchored in a fetch whose mate lands outside every region the
// facing view displays: counted per contig, and placed on the axis they do
// have so something can be drawn where they are. `counts` includes the
// alignments the placed lanes have no entry for, since a block can fall
// outside every displayed region of its own refName and still go somewhere.
export interface OffscreenMateData {
  mateRefNameDict: string[]
  // per dict id
  counts: Uint32Array
  // per dict id: the sequence those alignments cover, which is what the hover
  // leads with and what the strip ranks a stretch by
  alignedBp: Float64Array
  // per placed alignment: its span on this axis in cumBp, clamped to the
  // displayed region
  starts: Float64Array
  ends: Float64Array
  mateRefNameIds: Uint32Array
  // the block's own bp length before the clamp, which is what a `length`
  // filter reads
  lengths: Float32Array
  // where it lands on the contig it names, in that contig's own bp: there is
  // no ruler on this side to make a cumBp against. ArrayLike because the
  // culled lane hands the feature table's own uint32 lanes here.
  mateStarts: ArrayLike<number>
  mateEnds: ArrayLike<number>
}

// The worker's marks, with what a `filter` reads of each placed alignment
// beyond its length: the orientation, the contig it is anchored on (this
// axis's), and the track's channels, as the ribbons carry them
export interface FetchedOffscreenMates extends OffscreenMateData {
  strands: Int8Array
  refNameDict: string[]
  refNameIds: Uint32Array
  attributes: Record<string, Float32Array>
  attributeRanges: Record<string, AttributeRange>
}

export function emptyOffscreenMates(): FetchedOffscreenMates {
  return {
    mateRefNameDict: [],
    counts: new Uint32Array(0),
    alignedBp: new Float64Array(0),
    starts: new Float64Array(0),
    ends: new Float64Array(0),
    mateRefNameIds: new Uint32Array(0),
    lengths: new Float32Array(0),
    mateStarts: new Float64Array(0),
    mateEnds: new Float64Array(0),
    strands: new Int8Array(0),
    refNameDict: [],
    refNameIds: new Uint32Array(0),
    attributes: {},
    attributeRanges: {},
  }
}

interface SpanOnContig {
  refName: string
  start: number
  end: number
}

// A collector rather than a second pass, so a whole-genome PAF does not hold
// one object per dropped alignment until the loop ends. The placed features
// are kept by reference, already alive in the fetch, for their channels.
export function createOffscreenMateCollector(
  queryIndex: BpRegionIndex,
  channelNames: readonly string[],
) {
  const mateRefNameDict = makeStringDict()
  const refNameDict = makeStringDict()
  const counts: number[] = []
  const alignedBp: number[] = []
  const starts: number[] = []
  const ends: number[] = []
  const mateRefNameIds: number[] = []
  const refNameIds: number[] = []
  const strands: number[] = []
  const lengths: number[] = []
  const mateStarts: number[] = []
  const mateEnds: number[] = []
  const placed: Feature[] = []

  return {
    // `anchor` is the end on this axis, which for a flipped alignment is not
    // the feature's own span; the feature is read for its strand and channels
    add(feature: Feature, anchor: SpanOnContig, mate: SpanOnContig) {
      const { refName, start, end } = anchor
      const id = mateRefNameDict.idFor(mate.refName)
      counts[id] = (counts[id] ?? 0) + 1
      const lo = Math.min(start, end)
      const hi = Math.max(start, end)
      alignedBp[id] = (alignedBp[id] ?? 0) + (hi - lo)
      const entry = findRegionEntry(queryIndex, refName, lo, hi)
      if (entry) {
        const a = cumBpInEntry(entry, lo)
        const b = cumBpInEntry(entry, hi)
        starts.push(Math.min(a, b))
        ends.push(Math.max(a, b))
        mateRefNameIds.push(id)
        refNameIds.push(refNameDict.idFor(refName))
        strands.push(feature.get('strand') ?? 0)
        lengths.push(hi - lo)
        mateStarts.push(Math.min(mate.start, mate.end))
        mateEnds.push(Math.max(mate.start, mate.end))
        placed.push(feature)
      }
    },
    finish(): FetchedOffscreenMates {
      const channels = createAttributeChannels(channelNames, placed.length)
      for (const [i, feature] of placed.entries()) {
        writeFeatureChannels(channels.list, i, feature)
      }
      return {
        mateRefNameDict: mateRefNameDict.dict,
        counts: Uint32Array.from(counts),
        alignedBp: Float64Array.from(alignedBp),
        starts: Float64Array.from(starts),
        ends: Float64Array.from(ends),
        mateRefNameIds: Uint32Array.from(mateRefNameIds),
        lengths: Float32Array.from(lengths),
        mateStarts: Float64Array.from(mateStarts),
        mateEnds: Float64Array.from(mateEnds),
        strands: Int8Array.from(strands),
        refNameDict: refNameDict.dict,
        refNameIds: Uint32Array.from(refNameIds),
        ...channels.finish(placed.length),
      }
    },
  }
}

// Rewrite the contig names out of the adapter's namespace into the
// assembly's canonical one. The mates name contigs nobody requested, so they
// arrive spelled the way the file spells them (REFNAME_NAMESPACES.md). The
// two lanes take opposite resolvers: `offscreenMates` names target-axis mates
// on query-axis anchors and `targetOffscreenMates` the reverse. `counts` is
// one entry per mate contig, so a collapse sums it where the per-feature lane
// reindexes.
export function renameOffscreenMates(
  data: FetchedOffscreenMates,
  {
    mate,
    anchor,
  }: {
    mate: (refName: string) => string
    anchor: (refName: string) => string
  },
): FetchedOffscreenMates {
  const anchors = renameDictLane({
    dict: data.refNameDict,
    ids: data.refNameIds,
    canonical: anchor,
  })
  const { dict, ids, remap } = renameDictLane({
    dict: data.mateRefNameDict,
    ids: data.mateRefNameIds,
    canonical: mate,
  })
  const renamed = {
    ...data,
    refNameDict: anchors.dict,
    refNameIds: anchors.ids,
    mateRefNameDict: dict,
    mateRefNameIds: ids,
  }
  if (dict.length === data.mateRefNameDict.length) {
    return renamed
  }
  const counts = new Uint32Array(dict.length)
  const alignedBp = new Float64Array(dict.length)
  for (let i = 0; i < remap.length; i++) {
    const to = remap[i]!
    counts[to] = counts[to]! + (data.counts[i] ?? 0)
    alignedBp[to] = alignedBp[to]! + (data.alignedBp[i] ?? 0)
  }
  return { ...renamed, counts, alignedBp }
}

// The entries left once `refused` is dropped, and the contig tallies less
// what the refused ones counted
function withoutEntries(
  data: FetchedOffscreenMates,
  refused: readonly number[],
): FetchedOffscreenMates {
  const counts = Uint32Array.from(data.counts)
  const alignedBp = Float64Array.from(data.alignedBp)
  const dropped = new Uint8Array(data.starts.length)
  for (const i of refused) {
    const id = data.mateRefNameIds[i]!
    counts[id] = counts[id]! - 1
    alignedBp[id] = alignedBp[id]! - data.lengths[i]!
    dropped[i] = 1
  }
  const kept = Array.from(data.starts.keys()).filter(i => !dropped[i])
  return {
    ...data,
    counts,
    alignedBp,
    starts: Float64Array.from(kept, i => data.starts[i]!),
    ends: Float64Array.from(kept, i => data.ends[i]!),
    mateRefNameIds: Uint32Array.from(kept, i => data.mateRefNameIds[i]!),
    lengths: Float32Array.from(kept, i => data.lengths[i]!),
    mateStarts: Float64Array.from(kept, i => data.mateStarts[i]!),
    mateEnds: Float64Array.from(kept, i => data.mateEnds[i]!),
    strands: Int8Array.from(kept, i => data.strands[i]!),
    refNameIds: Uint32Array.from(kept, i => data.refNameIds[i]!),
    attributes: Object.fromEntries(
      Object.entries(data.attributes).map(([name, lane]) => [
        name,
        Float32Array.from(kept, i => lane[i]!),
      ]),
    ),
  }
}

type MateFilterArgs = { axis: 'query' | 'target' } & Omit<
  FilterExtras,
  'lengthOf'
>

/**
 * The view's `filter` over the placed entries, tested as the ribbons are, or
 * undefined to admit all. `axis` is the one the entries are placed on: on
 * the target axis the anchored contig is the alignment's target and the mate
 * its query.
 */
export function offscreenMateFilter(
  data: FetchedOffscreenMates,
  predicates: readonly FieldPredicate[],
  { axis, ...extras }: MateFilterArgs,
) {
  const lanes =
    axis === 'query'
      ? data
      : {
          ...data,
          refNameDict: data.mateRefNameDict,
          refNameIds: data.mateRefNameIds,
          mateRefNameDict: data.refNameDict,
          mateRefNameIds: data.refNameIds,
        }
  return comparativeFilter(predicates, lanes, {
    ...extras,
    lengthOf: i => data.lengths[i]!,
  })
}

/**
 * The placed entries the view's `filter` admits, each refused one taken off
 * its contig's tallies too, as the culled ribbons' marks drop theirs. An
 * entry the worker could not place has no lanes and keeps counting.
 */
export function admittedOffscreenMates(
  data: FetchedOffscreenMates,
  predicates: readonly FieldPredicate[],
  args: MateFilterArgs,
): FetchedOffscreenMates {
  const passes = offscreenMateFilter(data, predicates, args)
  const refused = passes
    ? Array.from(data.starts.keys()).filter(i => !passes(i))
    : []
  return refused.length > 0 ? withoutEntries(data, refused) : data
}
