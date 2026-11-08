import { fetchFeaturesFromAdapter } from '../shared/fetchFeaturesFromAdapter.ts'
import { drawnReadMask, featureSource } from './filterChainFeatures.ts'
import { sampleLanes } from './sampleLanes.ts'

import type { ExportRead } from './GetExportReads.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'

export async function executeGetExportReads({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RpcExecuteArgs<'PileupGetExportReads'>
}) {
  const {
    sessionId,
    adapterConfig,
    sequenceAdapter,
    regions,
    filter,
    facet,
    pinnedInsertSizeBand,
    statusCallback,
    signal,
  } = args
  const reads: ExportRead<SimpleFeatureSerialized>[] = []
  for (const region of regions) {
    const { featuresArray } = await fetchFeaturesFromAdapter({
      pluginManager,
      sessionId,
      adapterConfig,
      sequenceAdapter,
      region,
      filter,
      statusCallback,
      signal,
    })
    const { insertSizeBand, lanes } = sampleLanes({
      featuresArray,
      filter,
      facet,
      pinnedInsertSizeBand,
      jexl: pluginManager.jexl,
    })
    const laned = lanes.flatMap(({ key, features }) =>
      features.map(feature => ({ feature, lane: key })),
    )
    const drawn = drawnReadMask(
      featureSource(
        laned.map(r => r.feature),
        () => insertSizeBand,
      ),
      filter,
    )
    for (const [i, { feature, lane }] of laned.entries()) {
      reads.push({
        feature: feature.toJSON(),
        lane,
        drawn: drawn ? drawn[i] === 1 : true,
      })
    }
  }
  return reads
}
