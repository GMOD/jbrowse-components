import { clusterObject, toNewick } from '@gmod/hclust'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { updateStatus } from '@jbrowse/core/util'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { clusterProgressStatus } from '@jbrowse/tree-sidebar'

import { buildMultiRowMatrix } from './buildMultiRowMatrix.ts'
import { makeFeatureColorResolver } from '../MultiRowGetFeaturesRPC/packMultiRowFeatures.ts'

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
  for (const region of regions) {
    const feats = await updateStatus('Fetching features', statusCallback, () =>
      dataAdapter.getFeaturesArray(region, { statusCallback, stopToken }),
    )
    checkStopToken2(stopTokenCheck)
    for (const f of feats) {
      const raw = f.get(partitionField)
      features.push({
        row: raw === undefined || raw === null ? '' : String(raw),
        start: f.get('start'),
        end: f.get('end'),
        colorKey: featureColor(f).css,
      })
    }
  }

  const matrix = buildMultiRowMatrix({ sources, regions, features })
  // clusterObject keys rows by name and returns `order` as indices into the
  // key insertion order — build the object in `sources` order so those indices
  // map straight back through buildClusteredLayout(sourcesWithoutLayout, ...).
  const data: Record<string, number[]> = {}
  for (let i = 0; i < sources.length; i++) {
    data[sources[i]!] = matrix[i]!
  }
  const result = await clusterObject({
    data,
    onProgress: p => {
      statusCallback(clusterProgressStatus(p))
    },
    checkCancellation: () => {
      checkStopToken2(stopTokenCheck)
    },
  })
  return { order: result.order, tree: toNewick(result.tree) }
}
