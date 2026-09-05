import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { createStatusFanOut, updateStatus } from '@jbrowse/core/util'
import { checkStopTokenThrottled } from '@jbrowse/core/util/stopToken'

import {
  makeFeatureColorResolver,
  makeFeaturePartitionResolver,
} from '../MultiRowGetFeaturesRPC/packMultiRowFeatures.ts'
import { dedupeFeaturesById } from '../RenderFeatureDataRPC/dedupeFeatures.ts'
import { buildMultiRowMatrix } from './buildMultiRowMatrix.ts'

import type { MatrixFeature } from './buildMultiRowMatrix.ts'
import type { MultiRowClusterFeaturesArgs } from './rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcCallContext } from '@jbrowse/core/rpc/RpcRegistry'
import type { StopTokenChecker } from '@jbrowse/core/util/stopToken'

export async function collectMultiRowMatrix({
  pluginManager,
  args,
  stopTokenCheck,
}: {
  pluginManager: PluginManager
  args: MultiRowClusterFeaturesArgs & RpcCallContext
  stopTokenCheck: StopTokenChecker
}) {
  const {
    sessionId,
    adapterConfig,
    regions,
    sources,
    partitionField,
    colorConfig,
    stopToken,
    statusCallback,
  } = args
  const dataAdapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig,
  })

  const featureColor = makeFeatureColorResolver(colorConfig, pluginManager.jexl)
  const featurePartition = makeFeaturePartitionResolver(
    partitionField,
    pluginManager.jexl,
  )
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
            stopToken,
          }),
        ),
      ),
  )
  const features: MatrixFeature[] = []
  for (const [regionIndex, feats] of featuresPerRegion.entries()) {
    checkStopTokenThrottled(stopTokenCheck)
    // Dedup per region, not across the fetch: a feature appearing in two
    // clustered regions covers bins in both.
    for (const f of dedupeFeaturesById(feats).values()) {
      features.push({
        regionIndex,
        row: featurePartition(f),
        start: f.get('start'),
        end: f.get('end'),
        colorKey: featureColor(f).css,
      })
    }
  }

  return buildMultiRowMatrix({ sources, regions, features })
}
