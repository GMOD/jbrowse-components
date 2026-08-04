import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { createStatusFanOut } from '@jbrowse/core/util'
import { checkStopTokenThrottled } from '@jbrowse/core/util/stopToken'

import { isMultiSource } from '../multiSourceAdapter.ts'
import { groupFeaturesBySource } from '../util.ts'

import type { RawFeatureArrays } from '../util.ts'
import type { GetScoreMatrixArgs } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

// One region's slice of the concatenated row: the column it starts at, how many
// columns it gets, and the base its first column begins at. Every visible block
// contributes one, so a multi-region (e.g. whole-genome) view clusters on the
// full visible data instead of silently only the first block.
interface Segment {
  colOffset: number
  width: number
  regionStart: number
}

function buildSegments(regions: Region[], invBpPerPx: number) {
  const segments: Segment[] = []
  let totalWidth = 0
  for (const r of regions) {
    const width = Math.max(0, Math.floor((r.end - r.start) * invBpPerPx))
    segments.push({ colOffset: totalWidth, width, regionStart: r.start })
    totalWidth += width
  }
  return { segments, totalWidth }
}

// Add one feature's score to every column of `seg` it covers.
//
// Summed with a per-column count rather than assigned, because several features
// commonly land in one column: at 10kb/px a column holds hundreds of a
// bedMethyl's CpGs, and taking whichever the adapter happened to emit last
// sampled one of them at random. Averaging is also what makes the two fetch
// paths measure the same thing — a BigWig zoom bin already *is* a mean, so a
// column that averages agrees with one that read a summary bin rather than
// differing by however the file was ordered. Where features tile without
// overlapping (every BigWig bin, a well-formed bedGraph) the count is 1 and this
// is exactly the value that was already stored.
//
// The column math lives here, once, for both walkers below. Both edges truncate,
// so a feature narrower than a column is floored to the one it starts in:
// without that a subtrack whose features are *all* sub-column — the same
// base-resolution bedGraph/bedMethyl case — contributed an all-zero row, and the
// clusterer had nothing to tell the rows apart by.
function addSpan(
  sums: Float32Array,
  counts: Int32Array,
  seg: Segment,
  invBpPerPx: number,
  fstart: number,
  fend: number,
  score: number,
) {
  const { colOffset, width, regionStart } = seg
  if (fend <= regionStart) {
    return
  }
  const startX = Math.max(0, ((fstart - regionStart) * invBpPerPx) | 0)
  const rawEndX = ((fend - regionStart) * invBpPerPx) | 0
  const endX = Math.min(width, Math.max(rawEndX, startX + 1))
  for (let x = startX; x < endX; x++) {
    const col = colOffset + x
    sums[col] = sums[col]! + score
    counts[col] = counts[col]! + 1
  }
}

function addRawArrays(
  sums: Float32Array,
  counts: Int32Array,
  seg: Segment,
  invBpPerPx: number,
  raw: RawFeatureArrays,
) {
  const { starts, ends, scores, count } = raw
  for (let i = 0; i < count; i++) {
    addSpan(sums, counts, seg, invBpPerPx, starts[i]!, ends[i]!, scores[i]!)
  }
}

function addFeatures(
  sums: Float32Array,
  counts: Int32Array,
  seg: Segment,
  invBpPerPx: number,
  features: Feature[],
) {
  for (const feat of features) {
    addSpan(
      sums,
      counts,
      seg,
      invBpPerPx,
      feat.get('start'),
      feat.get('end'),
      feat.get('score') ?? 0,
    )
  }
}

// Per-source values for every region, in whichever form the adapter serves them.
type MatrixData =
  | { kind: 'raw'; bySource: Map<string, RawFeatureArrays[]> }
  | { kind: 'features'; perRegion: Map<string, Feature[]>[] }

async function fetchMatrixData(
  dataAdapter: BaseFeatureDataAdapter,
  regions: Region[],
  args: GetScoreMatrixArgs,
): Promise<MatrixData> {
  // The same fast path the render RPC takes (see isMultiSource): typed arrays,
  // every region in one call per subtrack, and no grouping pass. Clustering
  // otherwise re-fetched what the display had just drawn down the slow route —
  // one region at a time, a Feature object allocated per bin per subtrack, then
  // a walk over all of them to rebuild the per-source split the adapter already
  // knew.
  if (isMultiSource(dataAdapter)) {
    const perSource = await dataAdapter.getMultiSourceFeatureArraysMulti(
      regions,
      args,
    )
    return {
      kind: 'raw',
      bySource: new Map(perSource.map(p => [p.source, p.raws])),
    }
  }

  // An adapter carrying several sources in one file (bedMethyl, a bedGraph with
  // a source column). Fetched together rather than one region at a time, with
  // each region on its own status slot so the concurrent downloads aggregate
  // into one bar instead of clobbering the shared field.
  const slot = createStatusFanOut(args.statusCallback)
  const perRegion = await Promise.all(
    regions.map(async region =>
      groupFeaturesBySource(
        await dataAdapter.getFeaturesArray(region, {
          ...args,
          statusCallback: slot(),
        }),
      ),
    ),
  )
  return { kind: 'features', perRegion }
}

export async function getScoreMatrix({
  pluginManager,
  args,
}: {
  args: GetScoreMatrixArgs
  pluginManager: PluginManager
}) {
  const {
    sources,
    regions,
    adapterConfig,
    sessionId,
    bpPerPx,
    stopTokenCheck,
  } = args
  const dataAdapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig,
  })

  const invBpPerPx = 1 / bpPerPx
  const { segments, totalWidth } = buildSegments(regions, invBpPerPx)

  // Keyed in `sources` order and kept that way: the cluster `order` comes back
  // as indices into this map and buildClusteredLayout maps them into the
  // caller's source list (see ClusterMatrix).
  // Float32Array<ArrayBuffer>, not the ArrayBufferLike default: these buffers
  // are handed to postMessage as transferables, and naming the non-shared buffer
  // here is what lets the RPC method transfer them without a cast.
  const rows = new Map<string, Float32Array<ArrayBuffer>>()
  for (const { name } of sources) {
    rows.set(name, new Float32Array(totalWidth))
  }

  const data = await fetchMatrixData(dataAdapter, regions, args)

  // One counts array reused across sources, not one per row: each row is
  // averaged before the next starts, so only one is ever live. Binning stays
  // sequential — it writes into the shared matrix and has to stay interruptible.
  const counts = new Int32Array(totalWidth)
  for (const { name } of sources) {
    const sums = rows.get(name)!
    counts.fill(0)
    for (const [i, seg] of segments.entries()) {
      if (data.kind === 'raw') {
        const raw = data.bySource.get(name)?.[i]
        if (raw) {
          addRawArrays(sums, counts, seg, invBpPerPx, raw)
        }
      } else {
        const features = data.perRegion[i]!.get(name)
        if (features) {
          addFeatures(sums, counts, seg, invBpPerPx, features)
        }
      }
    }
    // A column nothing covered stays 0 rather than becoming NaN.
    for (let x = 0; x < totalWidth; x++) {
      const n = counts[x]!
      if (n > 1) {
        sums[x] = sums[x]! / n
      }
    }
    checkStopTokenThrottled(stopTokenCheck)
  }

  return rows
}
