import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { updateStatus } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { collectWiggleTransferables } from '@jbrowse/wiggle-core'

import {
  SINGLE_WIGGLE_SOURCE_NAME,
  featuresToRaw,
  processFeaturesFromArrays,
} from '../util.ts'

import type { RawFeatureArrays, WiggleDataResult } from '../util.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

interface ExecuteParams {
  pluginManager: PluginManager
  args: {
    sessionId: string
    adapterConfig: Record<string, unknown>
    region: Region
    useBicolor?: boolean
    bicolorPivot?: number
    stopToken?: StopToken
    bpPerPx?: number
    resolution?: number
    statusCallback?: StatusCallback
  }
}

function hasFeatureArrays(
  adapter: BaseFeatureDataAdapter,
): adapter is BaseFeatureDataAdapter & {
  getFeatureArrays(
    region: Region,
    opts: {
      bpPerPx: number
      resolution: number
      statusCallback?: StatusCallback
      stopToken?: StopToken
    },
  ): Promise<RawFeatureArrays>
} {
  return 'getFeatureArrays' in adapter
}

export async function executeRenderWiggleData({
  pluginManager,
  args,
}: ExecuteParams) {
  const {
    sessionId,
    adapterConfig,
    region,
    useBicolor = true,
    bicolorPivot = 0,
    stopToken,
    bpPerPx = 0,
    resolution = 1,
    statusCallback,
  } = args

  const stopTokenCheck = createStopTokenChecker(stopToken)

  const dataAdapter = (
    await getAdapter(pluginManager, sessionId, adapterConfig)
  ).dataAdapter as BaseFeatureDataAdapter

  // statusCallback/stopToken let the adapter report determinate download progress
  // (e.g. BigWig block fetches) and stay interruptible mid-fetch
  const fetchOpts = { bpPerPx, resolution, statusCallback, stopToken }
  const raw = hasFeatureArrays(dataAdapter)
    ? await updateStatus('Loading wiggle data', statusCallback, () =>
        dataAdapter.getFeatureArrays(region, fetchOpts),
      )
    : featuresToRaw(
        await updateStatus('Loading wiggle data', statusCallback, () =>
          dataAdapter.getFeaturesArray(region, fetchOpts),
        ),
      )

  checkStopToken2(stopTokenCheck)

  const arrays = processFeaturesFromArrays(raw, bicolorPivot, useBicolor)
  const result: WiggleDataResult = {
    sources: [{ name: SINGLE_WIGGLE_SOURCE_NAME, ...arrays }],
  }
  return rpcResult(result, collectWiggleTransferables(result))
}
