import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { checkAbortSignal } from '@jbrowse/core/util/aborting'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { collectWiggleTransferables } from '@jbrowse/wiggle-core'

import { fetchRegionRaws } from '../fetchRegionRaws.ts'
import {
  SINGLE_WIGGLE_SOURCE_NAME,
  processFeaturesFromArrays,
} from '../util.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { WiggleDataResult } from '@jbrowse/wiggle-core'

interface ExecuteParams {
  pluginManager: PluginManager
  args: {
    sessionId: string
    adapterConfig: Record<string, unknown>
    regions: Region[]
    signal?: AbortSignal
    bpPerPx?: number
    resolution?: number
    scoreField?: string
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
    signal,
    bpPerPx = 0,
    resolution = 1,
    scoreField,
    statusCallback,
  } = args

  const dataAdapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig,
  })

  // statusCallback/signal let the adapter report determinate download progress
  // (e.g. BigWig block fetches) and stay interruptible mid-fetch
  const fetchOpts = {
    bpPerPx,
    resolution,
    scoreField,
    statusCallback,
    signal,
  }
  const [raws, zoomRange] = await updateStatus(
    'Downloading wiggle data',
    statusCallback,
    () =>
      Promise.all([
        fetchRegionRaws(dataAdapter, regions, fetchOpts),
        dataAdapter.getZoomRange(fetchOpts),
      ]),
  )

  checkAbortSignal(signal)

  const results: WiggleDataResult[] = raws.map(raw => ({
    sources: [
      {
        name: SINGLE_WIGGLE_SOURCE_NAME,
        ...processFeaturesFromArrays(raw),
      },
    ],
    zoomRange,
  }))
  return rpcResult(results, collectWiggleTransferables(results))
}
