import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { createProgressReporter, updateStatus } from '@jbrowse/core/util'
import { rpcResultWithArrayBuffers } from '@jbrowse/core/util/librpc'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import { packMultiRowFeatures } from './packMultiRowFeatures.ts'

import type { MultiRowGetFeaturesArgs } from './rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'

export async function executeMultiRowGetFeatures({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: MultiRowGetFeaturesArgs
}) {
  const {
    sessionId,
    adapterConfig,
    region,
    byteLimit,
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

  // Stage 1 (cheap): index-only byte estimate before any feature download. An
  // over-budget region short-circuits here — the same fold-into-fetch gate the
  // feature-render RPC uses (executeRenderFeatureData). Adapters with no index
  // estimate return undefined and fall through to the density gate.
  let bytes: number | undefined
  if (byteLimit !== undefined) {
    bytes = await dataAdapter.getRegionByteSize([region], {
      stopToken,
      statusCallback,
    })
    checkStopToken2(stopTokenCheck)
    if (bytes !== undefined && bytes > byteLimit) {
      return { regionTooLarge: true as const, bytes }
    }
  }

  const featuresArray = await updateStatus(
    'Downloading features',
    statusCallback,
    () => dataAdapter.getFeaturesArray(region, { statusCallback, stopToken }),
  )
  checkStopToken2(stopTokenCheck)

  // Dedup by feature id: multiple adapter passes can yield the same feature id
  // (mirrors the feature-render RPC), which would otherwise double-count the
  // density gate and pack duplicate quads.
  const featureMap = new Map<string, Feature>()
  for (const f of featuresArray) {
    if (!featureMap.has(f.id())) {
      featureMap.set(f.id(), f)
    }
  }
  const features = [...featureMap.values()]

  const result = packMultiRowFeatures({
    features,
    partitionField,
    colorConfig,
    jexl: pluginManager.jexl,
    report: createProgressReporter({
      label: 'Processing features',
      total: features.length,
      statusCallback,
      stopTokenCheck,
    }),
  })
  // Caller-facing type comes from the RpcRegistry `MultiRowGetFeatures.return`
  // ambient declaration (see rpcTypes.ts); the framework unwraps the rpcResult
  // wrapper, so no return annotation or cast is needed here. Carry bytes +
  // featureCount so the main-thread gate maxes/re-derives them.
  return rpcResultWithArrayBuffers({
    ...result,
    bytes,
    featureCount: features.length,
  })
}
