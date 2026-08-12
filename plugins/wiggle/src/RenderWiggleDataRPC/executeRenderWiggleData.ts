import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  checkStopTokenThrottled,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { collectWiggleTransferables } from '@jbrowse/wiggle-core'

import { fetchRegionRaws } from '../fetchRegionRaws.ts'
import {
  SINGLE_WIGGLE_SOURCE_NAME,
  processFeaturesFromArrays,
} from '../util.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { WiggleDataResult } from '@jbrowse/wiggle-core'

interface ExecuteParams {
  pluginManager: PluginManager
  args: {
    sessionId: string
    adapterConfig: Record<string, unknown>
    regions: Region[]
    useBicolor?: boolean
    bicolorPivot?: number
    stopToken?: StopToken
    bpPerPx?: number
    resolution?: number
    statusCallback?: StatusCallback
  }
}

export async function executeRenderWiggleData({
  pluginManager,
  args,
}: ExecuteParams) {
  const {
    sessionId,
    adapterConfig,
    regions,
    useBicolor = true,
    bicolorPivot = 0,
    stopToken,
    bpPerPx = 0,
    resolution = 1,
    statusCallback,
  } = args

  const stopTokenCheck = createStopTokenChecker(stopToken)

  const dataAdapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig,
  })

  // statusCallback/stopToken let the adapter report determinate download progress
  // (e.g. BigWig block fetches) and stay interruptible mid-fetch
  const fetchOpts = { bpPerPx, resolution, statusCallback, stopToken }
  const raws = await updateStatus(
    'Downloading wiggle data',
    statusCallback,
    () => fetchRegionRaws(dataAdapter, regions, fetchOpts),
  )

  checkStopTokenThrottled(stopTokenCheck)

  const results: WiggleDataResult[] = raws.map(raw => ({
    sources: [
      {
        name: SINGLE_WIGGLE_SOURCE_NAME,
        ...processFeaturesFromArrays(raw, bicolorPivot, useBicolor),
      },
    ],
  }))
  return rpcResult(results, results.flatMap(collectWiggleTransferables))
}
