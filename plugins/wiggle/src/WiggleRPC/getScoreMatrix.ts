import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { createAbortBreakpoint } from '@jbrowse/core/util/aborting'
import { normalizeScoreUnclamped } from '@jbrowse/render-core/shaders/scoreScale'
import {
  binSpan,
  columnMeans,
  columnSegments,
} from '@jbrowse/tree-sidebar/binColumns'
import { summaryFieldOf } from '@jbrowse/wiggle-core/summaryFields'

import { fetchSourceRaws } from '../fetchRegionRaws.ts'

import type { RawFeatureArrays } from '../util.ts'
import type { GetScoreMatrixArgs, MatrixScale } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcCallContext } from '@jbrowse/core/rpc/RpcRegistry'
import type { ColumnSegment } from '@jbrowse/tree-sidebar/binColumns'
import type { SummaryField } from '@jbrowse/wiggle-core/summaryFields'

function summaryScores(raw: RawFeatureArrays, field: SummaryField) {
  return field === 'minScore'
    ? (raw.minScores ?? raw.scores)
    : field === 'maxScore'
      ? (raw.maxScores ?? raw.scores)
      : raw.scores
}

function addValues(
  sums: Float64Array,
  counts: Int32Array,
  seg: ColumnSegment,
  raw: RawFeatureArrays,
  field: SummaryField,
) {
  const { starts, ends, count } = raw
  const scores = summaryScores(raw, field)
  for (let i = 0; i < count; i++) {
    const score = scores[i]!
    if (!Number.isNaN(score)) {
      binSpan(sums, counts, 0, seg, starts[i]!, ends[i]!, score)
    }
  }
}

// Where each score sits up the axis, so a log or symlog track clusters on the
// heights it draws and a deep sample's peaks do not outweigh every other row's.
// Linear needs no pass: an affine map moves no average-linkage merge.
function toAxisSpace(row: Float32Array, scale: MatrixScale) {
  const [min, max] = scale.domain
  for (let x = 0; x < row.length; x++) {
    const v = row[x]!
    if (!Number.isNaN(v)) {
      row[x] = normalizeScoreUnclamped(
        v,
        min,
        max,
        scale.scaleType,
        scale.symlogConstant,
      )
    }
  }
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
  const { sources, regions, bpPerPx, yField = 'score', scale, signal } = args
  const field = summaryFieldOf(yField)
  const dataAdapter = await getFeatureAdapterOrThrow({ ...args, pluginManager })

  const { segments, width } = columnSegments(regions, bpPerPx)

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

  const valuesBySource = new Map(
    (await fetchSourceRaws(dataAdapter, regions, args, pluginManager.jexl)).map(
      p => [p.source, p.raws],
    ),
  )

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
        addValues(sums, counts, seg, values, field)
      }
    }
    // NaN where no feature covers a column: a file with no record there said
    // nothing, and reading that as 0 put a bedMethyl sample missing coverage
    // beside the unmethylated ones. The clustering run imputes the column's
    // mean, and the R script and TSV write NA.
    columnMeans(sums, counts, 0, row, Number.NaN)
    if (scale) {
      toAxisSpace(row, scale)
    }
    if (breakpoint.due()) {
      await breakpoint.yield()
    }
  }

  return rows
}
