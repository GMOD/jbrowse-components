import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { updateStatus } from '@jbrowse/core/util'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { WIGGLE_POS_COLOR_DEFAULT, processFeatures } from '../util.ts'

import type { WebGLMultiWiggleDataResult } from './types.ts'
import type { SourceInfo } from '../util.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'

interface ExecuteParams {
  pluginManager: PluginManager
  args: {
    sessionId: string
    adapterConfig: Record<string, unknown>
    region: Region
    sources?: SourceInfo[]
    bicolorPivot?: number
    stopToken?: string
    bpPerPx?: number
    resolution?: number
    statusCallback?: (msg: string) => void
  }
}

export async function executeRenderWebGLMultiWiggleData({
  pluginManager,
  args,
}: ExecuteParams): Promise<WebGLMultiWiggleDataResult> {
  const {
    sessionId,
    adapterConfig,
    region,
    sources: sourcesArg,
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

  let sourcesList: SourceInfo[] = sourcesArg || []
  if (sourcesList.length === 0 && 'getSources' in dataAdapter) {
    const adapterSources = await (
      dataAdapter as unknown as { getSources: () => Promise<SourceInfo[]> }
    ).getSources()
    sourcesList = adapterSources
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

  const regionStart = Math.floor(region.start)

  const featuresBySource = new Map<string, typeof featuresArray>()
  for (const feature of featuresArray) {
    const source = feature.get('source') || 'default'
    const existing = featuresBySource.get(source)
    if (existing) {
      existing.push(feature)
    } else {
      featuresBySource.set(source, [feature])
    }
  }

  const sourceNames =
    sourcesList.length > 0
      ? sourcesList.map(s => s.name)
      : Array.from(featuresBySource.keys())

  return {
    regionStart,
    sources: sourceNames.map(sourceName => {
      const features = featuresBySource.get(sourceName) || []
      const sourceInfo = sourcesList.find(s => s.name === sourceName)
      const color = sourceInfo?.color || WIGGLE_POS_COLOR_DEFAULT
      return {
        name: sourceName,
        color,
        ...processFeatures(features, regionStart, bicolorPivot),
      }
    }),
  }
}
