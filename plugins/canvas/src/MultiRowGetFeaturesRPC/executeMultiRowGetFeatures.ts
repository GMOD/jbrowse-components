import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { createProgressReporter, updateStatus } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import { packMultiRowFeatures } from './packMultiRowFeatures.ts'

import type {
  MultiRowGetFeaturesArgs,
  MultiRowGetFeaturesResult,
} from './rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

export async function executeMultiRowGetFeatures({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: MultiRowGetFeaturesArgs
}): Promise<MultiRowGetFeaturesResult> {
  const {
    sessionId,
    adapterConfig,
    region,
    partitionField,
    colorConfig,
    stopToken,
    statusCallback = () => {},
  } = args

  const stopTokenCheck = createStopTokenChecker(stopToken)
  const dataAdapter = (
    await getAdapter(pluginManager, sessionId, adapterConfig)
  ).dataAdapter as BaseFeatureDataAdapter

  const features = await updateStatus('Fetching features', statusCallback, () =>
    dataAdapter.getFeaturesArray(region, { statusCallback, stopToken }),
  )
  checkStopToken2(stopTokenCheck)

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
  return rpcResult(result, [
    result.featureStarts.buffer,
    result.featureEnds.buffer,
    result.featureColors.buffer,
    result.featurePartitionIndex.buffer,
  ]) as unknown as MultiRowGetFeaturesResult
}
