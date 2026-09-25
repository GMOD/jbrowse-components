import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { createStatusFanOut, updateStatus } from '@jbrowse/core/util'
import { checkAbortSignal } from '@jbrowse/core/util/aborting'

import { makeFeatureValueResolver } from '../MultiRowGetFeaturesRPC/packMultiRowFeatures.ts'
import { dedupeFeaturesById } from '../RenderFeatureDataRPC/dedupeFeatures.ts'
import { buildMultiRowMatrix } from './buildMultiRowMatrix.ts'

import type { MatrixFeature } from './buildMultiRowMatrix.ts'
import type { MultiRowClusterFeaturesArgs } from './rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcCallContext } from '@jbrowse/core/rpc/RpcRegistry'

export async function collectMultiRowMatrix({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: MultiRowClusterFeaturesArgs & RpcCallContext
}) {
  const {
    regions,
    sources,
    partitionField,
    clusterField,
    signal,
    statusCallback,
  } = args
  const dataAdapter = await getFeatureAdapterOrThrow({ ...args, pluginManager })

  const featurePartition = makeFeatureValueResolver(
    partitionField,
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
      features.push({
        regionIndex,
        row: featurePartition(f),
        start: f.get('start'),
        end: f.get('end'),
        value: featureValue(f),
      })
    }
  }

  return buildMultiRowMatrix({ sources, regions, features, clusterField })
}
