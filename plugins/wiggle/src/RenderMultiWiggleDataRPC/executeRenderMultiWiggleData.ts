import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { updateStatus } from '@jbrowse/core/util'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { processFeatures, processFeaturesFromArrays } from '../util.ts'

import type { MultiWiggleDataResult } from './types.ts'
import type { RawFeatureArrays, SourceInfo } from '../util.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

function hasMultiSourceFeatureArrays(
  adapter: BaseFeatureDataAdapter,
): adapter is BaseFeatureDataAdapter & {
  getMultiSourceFeatureArrays(
    region: Region,
    opts: {
      bpPerPx: number
      resolution: number
      sources?: SourceInfo[]
      stopToken?: StopToken
    },
  ): Promise<{ source: string; raw: RawFeatureArrays }[]>
} {
  return 'getMultiSourceFeatureArrays' in adapter
}

interface ExecuteParams {
  pluginManager: PluginManager
  args: {
    sessionId: string
    adapterConfig: Record<string, unknown>
    region: Region
    sources?: SourceInfo[]
    bicolorPivot?: number
    stopToken?: StopToken
    bpPerPx?: number
    resolution?: number
    statusCallback?: (msg: string) => void
  }
}

export async function executeRenderMultiWiggleData({
  pluginManager,
  args,
}: ExecuteParams): Promise<MultiWiggleDataResult> {
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

  const sourcesList: SourceInfo[] = sourcesArg?.length
    ? sourcesArg
    : await dataAdapter.getSources([region])

  if (hasMultiSourceFeatureArrays(dataAdapter)) {
    const perSource = await updateStatus(
      'Loading wiggle data',
      statusCallback,
      () =>
        dataAdapter.getMultiSourceFeatureArrays(region, {
          bpPerPx,
          resolution,
          sources: sourcesArg,
          stopToken,
        }),
    )
    checkStopToken2(stopTokenCheck)
    const arrayMap = new Map(
      perSource.map(p => [
        p.source,
        processFeaturesFromArrays(p.raw, bicolorPivot),
      ]),
    )
    const orderedSources: SourceInfo[] =
      sourcesList.length > 0
        ? sourcesList
        : perSource.map(({ source }) => ({ name: source }))
    return {
      sources: orderedSources.map(({ name, color }) => ({
        name,
        color,
        ...(arrayMap.get(name) ?? processFeatures([], bicolorPivot)),
      })),
    }
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

  const featuresBySource = new Map<string, typeof featuresArray>()
  for (const feature of featuresArray) {
    const source = feature.get('source') ?? 'default'
    const existing = featuresBySource.get(source)
    if (existing) {
      existing.push(feature)
    } else {
      featuresBySource.set(source, [feature])
    }
  }

  const orderedSources: SourceInfo[] =
    sourcesList.length > 0
      ? sourcesList
      : Array.from(featuresBySource.keys(), name => ({ name }))

  return {
    sources: orderedSources.map(({ name, color }) => ({
      name,
      color,
      ...processFeatures(featuresBySource.get(name) ?? [], bicolorPivot),
    })),
  }
}
