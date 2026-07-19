import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { groupBy, updateStatus } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { collectWiggleTransferables } from '@jbrowse/wiggle-core'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { featuresToRaw, processFeaturesFromArrays } from '../util.ts'

import type { RawFeatureArrays, SourceInfo, WiggleDataResult } from '../util.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region, StatusCallback } from '@jbrowse/core/util'
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

// `primary` order first (the caller's stable list), then any sources present in
// this region that the caller didn't know about, appended in adapter order.
function unionSourcesByName(
  primary: SourceInfo[],
  extra: SourceInfo[],
): SourceInfo[] {
  const seen = new Set(primary.map(s => s.name))
  return [...primary, ...extra.filter(s => !seen.has(s.name))]
}

// Plain feature adapter (e.g. BedTabixAdapter/BedGraphAdapter) used directly
// inside a MultiQuantitativeTrack — the modkit bedMethyl use-case. Synthesize
// per-source arrays by grouping features on their `source` field, mirroring the
// pre-webgl renderMultiWiggle path.
async function getFallbackSourceArrays(
  dataAdapter: BaseFeatureDataAdapter,
  region: Region,
  opts: {
    bpPerPx: number
    resolution: number
    sources?: SourceInfo[]
    stopToken?: StopToken
  },
): Promise<{ source: string; raw: RawFeatureArrays }[]> {
  const features = await firstValueFrom(
    dataAdapter.getFeatures(region, opts).pipe(toArray()),
  )
  const groups = groupBy(features, f => `${f.get('source')}`)
  return Object.entries(groups).map(([source, feats]) => ({
    source,
    raw: featuresToRaw(feats),
  }))
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
    statusCallback?: StatusCallback
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
}: ExecuteParams) {
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

  const dataAdapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig,
  })

  const isMulti = isMultiSource(dataAdapter)
  const perSource = await updateStatus(
    'Downloading wiggle data',
    statusCallback,
    () => {
      const opts = { bpPerPx, resolution, sources: sourcesArg, stopToken }
      return isMulti
        ? dataAdapter.getMultiSourceFeatureArrays(region, opts)
        : getFallbackSourceArrays(dataAdapter, region, opts)
    },
  )
  checkStopToken2(stopTokenCheck)

  const rawBySource = new Map(perSource.map(p => [p.source, p.raw]))
  // A multi-source adapter's getSources is authoritative and static, so the
  // caller's list (or getSources) is the whole story. A plain fallback adapter
  // has no source list — its sources are discovered per region — so union the
  // caller's list with whatever sources this region actually contains.
  // Otherwise a source with zero features in the first-fetched region would be
  // absent from that region's list, get echoed back on every later fetch, and
  // stay invisible even after navigating to where it has data.
  const presentSources: SourceInfo[] = perSource.map(({ source }) => ({
    name: source,
  }))
  const orderedSources: SourceInfo[] = isMulti
    ? sourcesArg?.length
      ? sourcesArg
      : await dataAdapter.getSources([region])
    : unionSourcesByName(sourcesArg ?? [], presentSources)

  const result: WiggleDataResult = {
    sources: orderedSources.map(source => ({
      ...source,
      ...processFeaturesFromArrays(
        rawBySource.get(source.name) ?? EMPTY_RAW,
        bicolorPivot,
      ),
    })),
  }
  return rpcResult(result, collectWiggleTransferables(result))
}
