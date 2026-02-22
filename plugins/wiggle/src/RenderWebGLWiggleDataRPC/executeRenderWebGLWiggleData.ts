import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { updateStatus } from '@jbrowse/core/util'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { processFeatures } from '../util.ts'

import type { WebGLWiggleDataResult } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'

interface ExecuteParams {
  pluginManager: PluginManager
  args: {
    sessionId: string
    adapterConfig: Record<string, unknown>
    region: Region
    bicolorPivot?: number
    stopToken?: string
    bpPerPx?: number
    resolution?: number
    statusCallback?: (msg: string) => void
  }
}

export async function executeRenderWebGLWiggleData({
  pluginManager,
  args,
}: ExecuteParams): Promise<WebGLWiggleDataResult> {
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

  const regionStart = Math.floor(region.start)

  return {
    regionStart,
    ...processFeatures(featuresArray, regionStart, bicolorPivot),
  }
}
