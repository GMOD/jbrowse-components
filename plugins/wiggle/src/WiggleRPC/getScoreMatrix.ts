import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { createStatusFanOut } from '@jbrowse/core/util'
import { createAbortBreakpoint } from '@jbrowse/core/util/aborting'
import {
  binSpan,
  columnMeans,
  columnSegments,
} from '@jbrowse/tree-sidebar/binColumns'

import { isMultiSource } from '../multiSourceAdapter.ts'
import { groupFeaturesBySource } from '../util.ts'

import type { RawFeatureArrays } from '../util.ts'
import type { GetScoreMatrixArgs } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { RpcCallContext } from '@jbrowse/core/rpc/RpcRegistry'
import type { Feature, Region } from '@jbrowse/core/util'
import type { ColumnSegment } from '@jbrowse/tree-sidebar/binColumns'

// What one source has in one region, in whichever form its adapter serves it:
// typed arrays from a multi-source adapter, plain features from one carrying
// several sources in a single file. Neither is converted into the other — a
// conversion here would allocate a second copy of data already in memory — so
// the binning below just takes whichever it was handed.
type RegionValues = RawFeatureArrays | Feature[]

function addValues(
  sums: Float64Array,
  counts: Int32Array,
  seg: ColumnSegment,
  invBpPerPx: number,
  values: RegionValues,
) {
  if (Array.isArray(values)) {
    for (const feat of values) {
      binSpan(
        sums,
        counts,
        0,
        seg,
        invBpPerPx,
        feat.get('start'),
        feat.get('end'),
        feat.get('score') ?? 0,
      )
    }
  } else {
    const { starts, ends, scores, count } = values
    for (let i = 0; i < count; i++) {
      binSpan(
        sums,
        counts,
        0,
        seg,
        invBpPerPx,
        starts[i]!,
        ends[i]!,
        scores[i]!,
      )
    }
  }
}

// Every source's values, keyed by source and indexed by region — one shape from
// both fetch paths, so the binning loop reads them the same way and only the
// fetch knows which adapter it was.
type MatrixData = Map<string, RegionValues[]>

async function fetchMatrixData(
  dataAdapter: BaseFeatureDataAdapter,
  regions: Region[],
  args: GetScoreMatrixArgs & RpcCallContext,
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
    return new Map(perSource.map(p => [p.source, p.raws]))
  }

  // An adapter carrying several sources in one file (bedMethyl, a bedGraph with
  // a source column). Fetched together rather than one region at a time, with
  // each region on its own status slot so the concurrent downloads aggregate
  // into one bar instead of clobbering the shared field.
  const slot = createStatusFanOut(args.statusCallback)
  const featuresPerRegion = await Promise.all(
    regions.map(region =>
      dataAdapter.getFeaturesArray(region, {
        ...args,
        statusCallback: slot(),
      }),
    ),
  )
  // Grouped straight into the by-source shape. A source missing from a region
  // leaves a hole rather than an empty array, which the binning loop skips.
  const bySource: MatrixData = new Map()
  for (const [i, features] of featuresPerRegion.entries()) {
    for (const [name, group] of groupFeaturesBySource(features)) {
      let perRegion = bySource.get(name)
      if (!perRegion) {
        perRegion = []
        bySource.set(name, perRegion)
      }
      perRegion[i] = group
    }
  }
  return bySource
}

// Payload plus call context rather than an `RpcExecuteArgs<'Key'>`, because
// this body serves two registry entries — `MultiWiggleGetScoreMatrix` reads the
// matrix out and `MultiWiggleClusterScoreMatrix` clusters it — so there is no
// single key to name. Every helper that IS one method's body names its key.
export async function getScoreMatrix({
  pluginManager,
  args,
}: {
  args: GetScoreMatrixArgs & RpcCallContext
  pluginManager: PluginManager
}) {
  const { sources, regions, bpPerPx, signal } = args
  const dataAdapter = await getFeatureAdapterOrThrow({ ...args, pluginManager })

  const { segments, width, invBpPerPx } = columnSegments(regions, bpPerPx)

  // Keyed in `sources` order and kept that way: the cluster `order` comes back
  // as indices into this map and buildClusteredLayout maps them into the
  // caller's source list (see ClusterMatrix).
  // Float32Array<ArrayBuffer>, not the ArrayBufferLike default: these buffers
  // are handed to postMessage as transferables, and naming the non-shared buffer
  // here is what lets the RPC method transfer them without a cast.
  const rows = new Map<string, Float32Array<ArrayBuffer>>()
  for (const { name } of sources) {
    rows.set(name, new Float32Array(width))
  }

  const valuesBySource = await fetchMatrixData(dataAdapter, regions, args)

  // One sums and one counts array reused across sources, not one per row: each
  // row is averaged before the next starts, so only one of each is ever live.
  // Binning stays sequential — it writes into the shared matrix and has to stay
  // interruptible.
  //
  // The accumulator is f64 while the row it lands in stays f32. A column sums
  // every feature covering it, hundreds of a bedMethyl's CpGs at 10 kb/px and
  // tens of thousands at whole-genome, and summing that many f32s into an f32
  // is naive summation with no compensation — the
  // clusterer's own distance build promotes to f64 every 16 elements and this
  // had no counterpart. Measured at 20,000 features per column it cost 3.3e-5
  // relative on the column mean, which widening drops to the 4e-8 floor of
  // storing an f64 back into an f32 at all.
  //
  // The ROW stays f32 deliberately: it is a postMessage transferable, a BigWig's
  // scores are f32 in the file, and no cluster order moved across the two arms
  // at any depth measured. So this buys a correct column mean, not a different
  // tree. measurements/wiggle-bin-accumulator-width.json.
  const sums = new Float64Array(width)
  const counts = new Int32Array(width)
  const breakpoint = createAbortBreakpoint(signal)
  for (const { name } of sources) {
    const row = rows.get(name)!
    const perRegion = valuesBySource.get(name)
    sums.fill(0)
    counts.fill(0)
    for (const [i, seg] of segments.entries()) {
      const values = perRegion?.[i]
      if (values) {
        addValues(sums, counts, seg, invBpPerPx, values)
      }
    }
    columnMeans(sums, counts, 0, row)
    if (breakpoint.due()) {
      await breakpoint.yield()
    }
  }

  return rows
}
