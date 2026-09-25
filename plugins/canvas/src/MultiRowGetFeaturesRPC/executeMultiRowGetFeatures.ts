import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { measureRegionBytes } from '@jbrowse/core/rpc/byteBudget'
import { createProgressReporter, updateStatus } from '@jbrowse/core/util'
import { checkAbortSignal } from '@jbrowse/core/util/aborting'
import { rpcResultWithArrayBuffers } from '@jbrowse/core/util/librpc'

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
    region,
    byteLimit,
    partitionField,
    lengthField,
    colorConfig,
    signal,
    statusCallback,
  } = args

  const dataAdapter = await getFeatureAdapterOrThrow({ ...args, pluginManager })

  const { bytes, tooLarge: tooManyBytes } = await measureRegionBytes({
    dataAdapter,
    regions: [region],
    byteLimit,
    signal,
    statusCallback,
  })
  if (tooManyBytes) {
    return tooManyBytes
  }

  const featuresArray = await updateStatus(
    'Downloading features',
    statusCallback,
    () => dataAdapter.getFeaturesArray(region, { statusCallback, signal }),
  )
  checkAbortSignal(signal)

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
      signal,
    }),
  })
  return rpcResultWithArrayBuffers({
    ...result,
    bytes,
  })
}
