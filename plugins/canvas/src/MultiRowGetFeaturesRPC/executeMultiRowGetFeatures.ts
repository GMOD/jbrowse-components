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
  return rpcResultWithArrayBuffers({
    ...result,
    bytes,
  })
}
