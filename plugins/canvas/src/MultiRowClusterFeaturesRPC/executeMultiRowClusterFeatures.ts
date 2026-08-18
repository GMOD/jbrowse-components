import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { updateStatus } from '@jbrowse/core/util'
import {
  checkStopTokenThrottled,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { clusterMatrix } from '@jbrowse/tree-sidebar'

import {
  makeFeatureColorResolver,
  makeFeaturePartitionResolver,
} from '../MultiRowGetFeaturesRPC/packMultiRowFeatures.ts'
import { dedupeFeaturesById } from '../RenderFeatureDataRPC/dedupeFeatures.ts'
import { buildMultiRowMatrix } from './buildMultiRowMatrix.ts'

import type { MatrixFeature } from './buildMultiRowMatrix.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

export async function executeMultiRowClusterFeatures({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RpcExecuteArgs<'MultiRowClusterFeatures'>
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
  const stopTokenCheck = createStopTokenChecker(stopToken)
  const dataAdapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig,
  })

  // must mirror the painting exactly — colorKey IS the on-screen color, so rows
  // cluster on what the user sees (see makeFeatureColorResolver)
  const featureColor = makeFeatureColorResolver(colorConfig, pluginManager.jexl)
  // likewise mirrors the painting: the row a feature lands in has to be the row
  // it was drawn in, or the cluster order describes an arrangement nobody sees
  const featurePartition = makeFeaturePartitionResolver(
    partitionField,
    pluginManager.jexl,
  )
  const features: MatrixFeature[] = []
  for (const [regionIndex, region] of regions.entries()) {
    const feats = await updateStatus(
      'Downloading features',
      statusCallback,
      () => dataAdapter.getFeaturesArray(region, { statusCallback, stopToken }),
    )
    checkStopTokenThrottled(stopTokenCheck)
    // Dedup by feature id — a duplicate would double-count coverage in the
    // matrix and skew the row order. Per region rather than across the whole
    // fetch: a feature genuinely appearing in two clustered regions covers bins
    // in both, and `regionIndex` is what keeps those apart.
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

  // Keyed in `sources` order by the builder, which is what the cluster `order`
  // indexes back into via buildClusteredLayout(sourcesWithoutLayout, ...) — see
  // ClusterMatrix for why the names have to ride along with the rows.
  return clusterMatrix({
    data: buildMultiRowMatrix({ sources, regions, features }),
    statusCallback,
    stopTokenCheck,
  })
}
