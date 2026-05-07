import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { updateStatus } from '@jbrowse/core/util'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import { processFeaturesFromArrays } from '../util.ts'

import type {
  RawFeatureArrays,
  SourceInfo,
  WiggleDataResult,
} from '../util.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

// Multi-source wiggle adapters fan out to inner adapters themselves and
// expose this method. The executor never groups features by source — that
// would be a third walk over already-typed-array data.
interface MultiSourceWiggleAdapter extends BaseFeatureDataAdapter {
  getMultiSourceFeatureArrays(
    region: Region,
    opts: {
      bpPerPx: number
      resolution: number
      sources?: SourceInfo[]
      stopToken?: StopToken
    },
  ): Promise<{ source: string; raw: RawFeatureArrays }[]>
}

function isMultiSource(
  adapter: BaseFeatureDataAdapter,
): adapter is MultiSourceWiggleAdapter {
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

const EMPTY_RAW: RawFeatureArrays = {
  starts: new Int32Array(0),
  ends: new Int32Array(0),
  scores: new Float32Array(0),
  minScores: undefined,
  maxScores: undefined,
  count: 0,
}

export async function executeRenderMultiWiggleData({
  pluginManager,
  args,
}: ExecuteParams): Promise<WiggleDataResult> {
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

  if (!isMultiSource(dataAdapter)) {
    throw new Error(
      `${adapterConfig.type as string} must implement getMultiSourceFeatureArrays to be used as a multi-wiggle adapter`,
    )
  }

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

  const rawBySource = new Map(perSource.map(p => [p.source, p.raw]))
  const sourcesList: SourceInfo[] = sourcesArg?.length
    ? sourcesArg
    : await dataAdapter.getSources([region])
  const orderedSources: SourceInfo[] =
    sourcesList.length > 0
      ? sourcesList
      : perSource.map(({ source }) => ({ name: source }))

  return {
    sources: orderedSources.map(({ name, color }) => ({
      name,
      color,
      ...processFeaturesFromArrays(
        rawBySource.get(name) ?? EMPTY_RAW,
        bicolorPivot,
      ),
    })),
  }
}
