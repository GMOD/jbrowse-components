import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
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

interface FetchOpts {
  bpPerPx: number
  resolution: number
  statusCallback?: StatusCallback
  stopToken?: StopToken
}

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

// Coalesced multi-region fast path (BigWig): one bbi pass over all regions,
// adjacent on-disk blocks deduped/merged across region boundaries.
function hasFeatureArraysMulti(
  adapter: BaseFeatureDataAdapter,
): adapter is BaseFeatureDataAdapter & {
  getFeatureArraysMulti(
    regions: Region[],
    opts: FetchOpts,
  ): Promise<RawFeatureArrays[]>
} {
  return 'getFeatureArraysMulti' in adapter
}

function hasFeatureArrays(
  adapter: BaseFeatureDataAdapter,
): adapter is BaseFeatureDataAdapter & {
  getFeatureArrays(region: Region, opts: FetchOpts): Promise<RawFeatureArrays>
} {
  return 'getFeatureArrays' in adapter
}

// Returns one RawFeatureArrays per region, aligned to input order. Adapters
// that coalesce (BigWig) serve all regions in a single pass; the rest fall back
// to the per-region loop that was always here — no behavior change for them.
function fetchRaws(
  adapter: BaseFeatureDataAdapter,
  regions: Region[],
  opts: FetchOpts,
): Promise<RawFeatureArrays[]> {
  if (hasFeatureArraysMulti(adapter)) {
    return adapter.getFeatureArraysMulti(regions, opts)
  }
  if (hasFeatureArrays(adapter)) {
    return Promise.all(
      regions.map(region => adapter.getFeatureArrays(region, opts)),
    )
  }
  return Promise.all(
    regions.map(region =>
      adapter.getFeaturesArray(region, opts).then(featuresToRaw),
    ),
  )
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
  const raws = await updateStatus('Loading wiggle data', statusCallback, () =>
    fetchRaws(dataAdapter, regions, fetchOpts),
  )

  checkStopToken2(stopTokenCheck)

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
