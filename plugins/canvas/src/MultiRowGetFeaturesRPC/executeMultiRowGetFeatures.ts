import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { measureRegionBytes } from '@jbrowse/core/rpc/byteBudget'
import { createProgressReporter, updateStatus } from '@jbrowse/core/util'
import { rpcResultWithArrayBuffers } from '@jbrowse/core/util/librpc'
import {
  checkStopTokenThrottled,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import { dedupeFeaturesById } from '../RenderFeatureDataRPC/dedupeFeatures.ts'
import { packMultiRowFeatures } from './packMultiRowFeatures.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

export async function executeMultiRowGetFeatures({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RpcExecuteArgs<'MultiRowGetFeatures'>
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
    statusCallback,
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
    regions: [region],
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

  // Dedup by feature id — a duplicate would otherwise pack duplicate quads. See
  // dedupeFeaturesById for why all three feature RPCs run the same one.
  const features = [...dedupeFeaturesById(featuresArray).values()]

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
  // wrapper, so no return annotation or cast is needed here. Carries `bytes` and
  // no feature count — this display gates on the byte axis only, so a count has
  // nothing on the main thread that would read it.
  return rpcResultWithArrayBuffers({
    ...result,
    bytes,
  })
}
