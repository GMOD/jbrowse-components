import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { createStatusFanOut, updateStatus } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  checkStopTokenThrottled,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { collectWiggleTransferables } from '@jbrowse/wiggle-core'

import { isMultiSource } from '../multiSourceAdapter.ts'
import {
  featuresToRaw,
  groupFeaturesBySource,
  processFeaturesFromArrays,
} from '../util.ts'

import type { RawFeatureArrays, SourceInfo, WiggleDataResult } from '../util.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

interface FetchOpts {
  bpPerPx: number
  resolution: number
  sources?: SourceInfo[]
  stopToken?: StopToken
  // Reaches the per-subtrack adapters so a multiwiggle gets the same
  // determinate byte progress a single-source wiggle does. The fan-out that
  // keeps N concurrent subtracks from clobbering each other lives in the
  // adapters (MultiWiggleAdapter, getFallbackSourceArrays below), not here —
  // this executor doesn't know how many files there are.
  statusCallback?: StatusCallback
}

// `primary` order first (the caller's stable list), then any sources present in
// these regions that the caller didn't know about, appended in adapter order.
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
// pre-webgl renderMultiWiggle path. A source is listed once it appears in any
// region, with empty arrays for the regions it's missing from.
//
// The regions download concurrently under one status field, so each gets its
// own createStatusFanOut slot (see MultiWiggleAdapter for the same idiom).
async function getFallbackSourceArrays(
  dataAdapter: BaseFeatureDataAdapter,
  regions: Region[],
  opts: FetchOpts,
): Promise<{ source: string; raws: RawFeatureArrays[] }[]> {
  const slot = createStatusFanOut(opts.statusCallback)
  const groupsPerRegion = await Promise.all(
    regions.map(async region => {
      const features = await dataAdapter.getFeaturesArray(region, {
        ...opts,
        statusCallback: slot(),
      })
      return groupFeaturesBySource(features)
    }),
  )
  const sources = [
    ...new Set(groupsPerRegion.flatMap(groups => [...groups.keys()])),
  ]
  return sources.map(source => ({
    source,
    raws: groupsPerRegion.map(groups =>
      featuresToRaw(groups.get(source) ?? []),
    ),
  }))
}

interface ExecuteParams {
  pluginManager: PluginManager
  args: {
    sessionId: string
    adapterConfig: Record<string, unknown>
    regions: Region[]
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
    regions,
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
      const opts = {
        bpPerPx,
        resolution,
        sources: sourcesArg,
        stopToken,
        statusCallback,
      }
      return isMulti
        ? dataAdapter.getMultiSourceFeatureArraysMulti(regions, opts)
        : getFallbackSourceArrays(dataAdapter, regions, opts)
    },
  )
  checkStopTokenThrottled(stopTokenCheck)

  const rawsBySource = new Map(perSource.map(p => [p.source, p.raws]))
  // A multi-source adapter's getSources is authoritative and static, so the
  // caller's list (or getSources) is the whole story. A plain fallback adapter
  // has no source list — its sources are discovered per region — so union the
  // caller's list with whatever sources these regions actually contain.
  // Otherwise a source with zero features in the fetched regions would be
  // absent from the payload, get echoed back on every later fetch, and stay
  // invisible even after navigating to where it has data.
  const orderedSources: SourceInfo[] = isMulti
    ? sourcesArg?.length
      ? sourcesArg
      : await dataAdapter.getSources(regions)
    : unionSourcesByName(
        sourcesArg ?? [],
        perSource.map(({ source }) => ({ name: source })),
      )

  // Every region carries the full source list — a source with no features here
  // still gets an entry, so row placement stays aligned across regions.
  const results: WiggleDataResult[] = regions.map((_region, regionIndex) => ({
    sources: orderedSources.map(source => ({
      ...source,
      ...processFeaturesFromArrays(
        rawsBySource.get(source.name)?.[regionIndex] ?? EMPTY_RAW,
        bicolorPivot,
      ),
    })),
  }))
  return rpcResult(results, results.flatMap(collectWiggleTransferables))
}
