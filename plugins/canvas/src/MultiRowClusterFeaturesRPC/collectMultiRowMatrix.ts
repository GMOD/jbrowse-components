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

// The matrix both multi-row clustering RPCs share: fetch the features over the
// regions, bucket them by the row the painting drew them in, and bin each row's
// colors. `MultiRowClusterFeatures` clusters it; `MultiRowGetFeatureMatrix`
// hands it back for the R-script path. Payload plus call context rather than
// an `RpcExecuteArgs<'Key'>`, because it serves two registry entries.
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

  // must mirror the painting exactly — colorKey IS the on-screen color, so rows
  // cluster on what the user sees (see makeFeatureColorResolver)
  const featureColor = makeFeatureColorResolver(colorConfig, pluginManager.jexl)
  // likewise mirrors the painting: the row a feature lands in has to be the row
  // it was drawn in, or the cluster order describes an arrangement nobody sees
  const featurePartition = makeFeaturePartitionResolver(
    partitionField,
    pluginManager.jexl,
  )
  // Every region at once: the regions are independent, and awaited one at a
  // time a 24-region clustering run paid 24 round trips end to end. Each gets
  // its own status slot so the concurrent downloads aggregate into one bar
  // rather than clobbering the shared field, the way the score matrix does.
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
  return buildMultiRowMatrix({ sources, regions, features })
}
