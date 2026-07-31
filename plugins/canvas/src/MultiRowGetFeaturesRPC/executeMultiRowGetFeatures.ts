import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { createProgressReporter, updateStatus } from '@jbrowse/core/util'
import { rpcResultWithArrayBuffers } from '@jbrowse/core/util/librpc'
import {
  checkStopTokenThrottled,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import { measureRegionBytes } from '../RenderFeatureDataRPC/byteGate.ts'
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
    lengthField,
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

  // Stage 1 (cheap): index-only byte estimate before any feature download — the
  // same shared fold-into-fetch gate the feature-render RPC uses. Byte-only here:
  // the display turns the mixin's density axis off, so there is no stage 1.5.
  const { bytes, tooLarge: tooManyBytes } = await measureRegionBytes({
    dataAdapter,
    region,
    byteLimit,
    stopToken,
    statusCallback,
    stopTokenCheck,
  })
  if (tooManyBytes) {
    return tooManyBytes
  }

  const featuresArray = await updateStatus(
    'Downloading features',
    statusCallback,
    () => dataAdapter.getFeaturesArray(region, { statusCallback, stopToken }),
  )
  checkStopTokenThrottled(stopTokenCheck)

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
    lengthField,
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
