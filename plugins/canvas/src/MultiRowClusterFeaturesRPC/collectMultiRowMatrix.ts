import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { createStatusFanOut, updateStatus } from '@jbrowse/core/util'
import { checkAbortSignal } from '@jbrowse/core/util/aborting'

import {
  makeFeatureValueResolver,
  splicedParts,
} from '../MultiRowGetFeaturesRPC/packMultiRowFeatures.ts'
import { dedupeFeaturesById } from '../RenderFeatureDataRPC/dedupeFeatures.ts'
import { buildMultiRowMatrix } from './buildMultiRowMatrix.ts'

import type { MatrixFeature } from './buildMultiRowMatrix.ts'
import type { MultiRowFeatureValuesArgs } from './rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcCallContext } from '@jbrowse/core/rpc/RpcRegistry'

/**
 * Every feature in `regions`, a spliced one as each block it paints, with the
 * row it paints in and its `clusterField` value, read through the resolver the painting partitions with, so the
 * clustering matrix and the column sort place each feature in the row the
 * painting drew it in.
 */
export async function collectMatrixFeatures({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: MultiRowFeatureValuesArgs & RpcCallContext
}) {
  const { regions, rowsField, clusterField, signal, statusCallback } = args
  const dataAdapter = await getFeatureAdapterOrThrow({ ...args, pluginManager })
  const featureRowValue = makeFeatureValueResolver(
    rowsField,
    pluginManager.jexl,
  )
  const featureValue = clusterField
    ? makeFeatureValueResolver(clusterField, pluginManager.jexl)
    : () => ''
  // Each concurrent download gets its own status slot so they aggregate into one
  // bar rather than clobbering the shared field.
  const slot = createStatusFanOut(statusCallback)
  const featuresPerRegion = await updateStatus(
    'Downloading features',
    statusCallback,
    () =>
      Promise.all(
        regions.map(region =>
          dataAdapter.getFeaturesArray(region, {
            statusCallback: slot(),
            signal,
          }),
        ),
      ),
  )
  const features: MatrixFeature[] = []
  for (const [regionIndex, feats] of featuresPerRegion.entries()) {
    checkAbortSignal(signal)
    // Dedup per region, not across the fetch: a feature appearing in two
    // clustered regions covers bins in both.
    for (const f of dedupeFeaturesById(feats).values()) {
      const row = featureRowValue(f)
      const value = featureValue(f)
      const parts = splicedParts(f) ?? [
        { start: f.get('start'), end: f.get('end') },
      ]
      for (const { start, end } of parts) {
        features.push({ regionIndex, row, start, end, value })
      }
    }
  }
  return features
}

export async function collectMultiRowMatrix({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: MultiRowFeatureValuesArgs & { sources: string[] } & RpcCallContext
}) {
  return buildMultiRowMatrix({
    sources: args.sources,
    regions: args.regions,
    features: await collectMatrixFeatures({ pluginManager, args }),
    clusterField: args.clusterField,
  })
}
