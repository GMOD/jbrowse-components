import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { updateStatus } from '@jbrowse/core/util'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { processFeatures } from '../util.ts'

import type { WiggleDataResult } from './types.ts'
import type { WiggleFeatureArrays } from '../util.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

interface ExecuteParams {
  pluginManager: PluginManager
  args: {
    sessionId: string
    adapterConfig: Record<string, unknown>
    region: Region
    bicolorPivot?: number
    stopToken?: StopToken
    bpPerPx?: number
    resolution?: number
    statusCallback?: (msg: string) => void
  }
}

function hasFeatureArrays(
  adapter: BaseFeatureDataAdapter,
): adapter is BaseFeatureDataAdapter & {
  getFeatureArrays(
    region: Region,
    opts: { bpPerPx: number; resolution: number; bicolorPivot: number },
  ): Promise<WiggleFeatureArrays>
} {
  return 'getFeatureArrays' in adapter
}

export async function executeRenderWiggleData({
  pluginManager,
  args,
}: ExecuteParams): Promise<WiggleDataResult> {
  const {
    sessionId,
    adapterConfig,
    region,
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

  const regionStart = Math.floor(region.start)

  if (hasFeatureArrays(dataAdapter)) {
    const featureArrays = await updateStatus(
      'Loading wiggle data',
      statusCallback,
      () =>
        dataAdapter.getFeatureArrays(region, {
          bpPerPx,
          resolution,
          bicolorPivot,
        }),
    )
    checkStopToken2(stopTokenCheck)
    return { regionStart, ...featureArrays }
  }

  const fetchOpts = { bpPerPx, resolution }
  const featuresArray = await updateStatus(
    'Loading wiggle data',
    statusCallback,
    () =>
      firstValueFrom(
        dataAdapter.getFeatures(region, fetchOpts).pipe(toArray()),
      ),
  )

  checkStopToken2(stopTokenCheck)

  return {
    regionStart,
    ...processFeatures(featuresArray, regionStart, bicolorPivot),
  }
}
