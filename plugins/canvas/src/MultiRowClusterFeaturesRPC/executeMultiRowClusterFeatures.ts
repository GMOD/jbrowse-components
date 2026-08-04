import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { updateStatus } from '@jbrowse/core/util'
import {
  checkStopTokenThrottled,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { clusterMatrix } from '@jbrowse/tree-sidebar'

import { makeFeatureColorResolver } from '../MultiRowGetFeaturesRPC/packMultiRowFeatures.ts'
import { buildMultiRowMatrix } from './buildMultiRowMatrix.ts'

import type { MatrixFeature } from './buildMultiRowMatrix.ts'
import type { MultiRowClusterFeaturesArgs } from './rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

export async function executeMultiRowClusterFeatures({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: MultiRowClusterFeaturesArgs
}) {
  const {
    sessionId,
    adapterConfig,
    regions,
    sources,
    partitionField,
    colorConfig,
    stopToken,
    statusCallback = () => {},
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
  const features: MatrixFeature[] = []
  for (const [regionIndex, region] of regions.entries()) {
    const feats = await updateStatus(
      'Downloading features',
      statusCallback,
      () => dataAdapter.getFeaturesArray(region, { statusCallback, stopToken }),
    )
    checkStopTokenThrottled(stopTokenCheck)
    // dedup by feature id (mirrors the get-features RPC): a duplicate would
    // double-count coverage in the clustering matrix and skew the row order
    const seen = new Set<string>()
    for (const f of feats) {
      if (!seen.has(f.id())) {
        seen.add(f.id())
        const raw = f.get(partitionField)
        features.push({
          regionIndex,
          row: raw === undefined || raw === null ? '' : String(raw),
          start: f.get('start'),
          end: f.get('end'),
          colorKey: featureColor(f).css,
        })
      }
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
