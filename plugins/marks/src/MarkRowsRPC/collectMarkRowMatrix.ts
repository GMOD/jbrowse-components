import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { createStatusFanOut, updateStatus } from '@jbrowse/core/util'
import { checkAbortSignal } from '@jbrowse/core/util/aborting'
import {
  facetLayers,
  runTransforms,
} from '@jbrowse/core/util/featureTransforms'
import { encodeFeatures } from '@jbrowse/core/util/markEncoding'
import {
  binSpan,
  columnMeans,
  columnSegments,
} from '@jbrowse/tree-sidebar/binColumns'

import type { MarkRowMatrixArgs } from './rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcCallContext } from '@jbrowse/core/rpc/RpcRegistry'
import type { FacetSection } from '@jbrowse/core/util/markEncoding'

/** Where each split row's matrix row starts in the flat sums, -1 for none asked. */
function rowOffsets(
  sections: readonly FacetSection[],
  matrixRowOf: ReadonlyMap<string, number>,
  width: number,
) {
  const last = sections.at(-1)
  const offsets = new Int32Array(last ? last.firstRow + last.rowCount : 0)
  offsets.fill(-1)
  for (const { key, firstRow, rowCount } of sections) {
    const r = matrixRowOf.get(key)
    if (r !== undefined) {
      offsets.fill(r * width, firstRow, firstRow + rowCount)
    }
  }
  return offsets
}

/**
 * The value matrix over `rows`: each region fetched and split as the display
 * fetches it, the one mark encoded, and each instance binned into its row's
 * columns by `binSpan`, the rule the quantitative display clusters by.
 */
export async function collectMarkRowMatrix({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: MarkRowMatrixArgs & RpcCallContext
}) {
  const {
    regions,
    rows,
    transform,
    facet,
    bpPerPx,
    layer,
    signal,
    statusCallback,
  } = args
  const { jexl } = pluginManager
  const dataAdapter = await getFeatureAdapterOrThrow({ ...args, pluginManager })
  const slot = createStatusFanOut(statusCallback)
  const fetched = await updateStatus(
    'Downloading features',
    statusCallback,
    () =>
      Promise.all(
        regions.map(region =>
          dataAdapter.getFeaturesArray(region, {
            bpPerPx,
            statusCallback: slot(),
            signal,
          }),
        ),
      ),
  )
  const { segments, width, invBpPerPx } = columnSegments(regions, bpPerPx)
  const matrixRowOf = new Map(rows.map((name, r) => [name, r]))
  const sums = new Float64Array(rows.length * width)
  const counts = new Int32Array(rows.length * width)
  for (const [regionIndex, features] of fetched.entries()) {
    checkAbortSignal(signal)
    const { layers, sections } = facetLayers(
      runTransforms(features, transform, jexl),
      facet,
      [{ transform: layer.transform, row: undefined }],
      jexl,
    )
    const split = layers[0]!
    const { x, x2, y, row, count } = encodeFeatures(
      split.features,
      { ...layer.encoding, row: split.rows },
      ['y', 'row'],
      { jexl },
    )
    const offsets = rowOffsets(sections, matrixRowOf, width)
    const segment = segments[regionIndex]!
    for (let i = 0; i < count; i++) {
      const offset = offsets[row[i]!] ?? -1
      if (offset !== -1) {
        binSpan(sums, counts, offset, segment, invBpPerPx, x[i]!, x2[i]!, y[i]!)
      }
    }
  }
  return new Map(
    rows.map((name, r) => [
      name,
      columnMeans(sums, counts, r * width, new Float32Array(width)),
    ]),
  )
}
