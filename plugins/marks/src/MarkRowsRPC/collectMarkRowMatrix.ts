import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { createStatusFanOut, updateStatus } from '@jbrowse/core/util'
import { checkAbortSignal } from '@jbrowse/core/util/aborting'
import {
  facetLayers,
  runTransforms,
} from '@jbrowse/core/util/featureTransforms'
import { encodeFeatures } from '@jbrowse/core/util/markEncoding'

import { buildMarkRowMatrix } from './buildMarkRowMatrix.ts'

import type { RowInstance } from './buildMarkRowMatrix.ts'
import type { MarkRowMatrixArgs } from './rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcCallContext } from '@jbrowse/core/rpc/RpcRegistry'
import type { FacetSection } from '@jbrowse/core/util/markEncoding'

function keyOfRow(sections: readonly FacetSection[], row: number) {
  return sections.find(s => row >= s.firstRow && row < s.firstRow + s.rowCount)
    ?.key
}

/**
 * The value matrix over `rows`: each region fetched and split as the display
 * fetches it, the one mark encoded, and each instance filed under the row the
 * split put it in.
 */
export async function collectMarkRowMatrix({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: MarkRowMatrixArgs & RpcCallContext
}) {
  const {
    sessionId,
    adapterConfig,
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
  const dataAdapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig,
  })
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
  const instances: RowInstance[] = []
  for (const [regionIndex, features] of fetched.entries()) {
    checkAbortSignal(signal)
    const { layers, sections } = facetLayers(
      runTransforms(features, transform, jexl),
      facet,
      [{ transform: layer.transform, row: undefined }],
      jexl,
    )
    const split = layers[0]!
    const encoded = encodeFeatures(
      split.features,
      { ...layer.encoding, row: split.rows },
      ['y', 'row'],
      { jexl },
    )
    for (let i = 0; i < encoded.count; i++) {
      const row = keyOfRow(sections, encoded.row[i]!)
      if (row !== undefined) {
        instances.push({
          regionIndex,
          row,
          start: encoded.x[i]!,
          end: encoded.x2[i]!,
          value: encoded.y[i]!,
        })
      }
    }
  }
  return buildMarkRowMatrix({ rows, regions, instances })
}
