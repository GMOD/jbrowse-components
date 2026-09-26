import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { checkAbortSignal } from '@jbrowse/core/util/aborting'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { collectWiggleTransferables } from '@jbrowse/wiggle-core'

import { fetchSourceRaws } from '../fetchRegionRaws.ts'
import { isMultiSource } from '../multiSourceAdapter.ts'
import { processFeaturesFromArrays } from '../util.ts'

import type { RawFeatureArrays } from '../util.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { SourceInfo, WiggleDataResult } from '@jbrowse/wiggle-core'

// `primary` order first (the caller's stable list), then any sources present in
// these regions that the caller didn't know about, appended in adapter order.
function unionSourcesByName(
  primary: SourceInfo[],
  extra: SourceInfo[],
): SourceInfo[] {
  const seen = new Set(primary.map(s => s.name))
  return [...primary, ...extra.filter(s => !seen.has(s.name))]
}

interface ExecuteParams {
  pluginManager: PluginManager
  args: {
    sessionId: string
    adapterConfig: Record<string, unknown>
    regions: Region[]
    sources?: SourceInfo[]
    signal?: AbortSignal
    bpPerPx?: number
    resolution?: number
    // The summary presentation the display resolved to, forwarded to the
    // adapter so one that stores min/max separately can skip reading them.
    // Optional: a caller that does not send it gets the summary either way.
    summaryScoreMode?: string
    scoreField?: string
    statusCallback?: StatusCallback
  }
}

// A shared constant only because processFeaturesFromArrays never returns its
// input arrays — with count 0 it hands back arrays it allocated itself, so
// nothing here reaches collectWiggleTransferables. That is the property the
// aliasing refactor `transferables.ts` describes would remove, and these
// buffers would then be transferred (and so detached) on the first region that
// lacks a source and be dead on the second; make this a function at the same
// time.
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
    regions,
    sources: sourcesArg,
    signal,
    bpPerPx = 0,
    resolution = 1,
    summaryScoreMode,
    scoreField,
    statusCallback,
  } = args

  const dataAdapter = await getFeatureAdapterOrThrow({ ...args, pluginManager })

  const isMulti = isMultiSource(dataAdapter)
  // summaryScoreMode is passed through, not acted on here: an adapter that
  // stores min/max separately can skip reading them when the rendering
  // cannot show them, which is the default (`avg`). Adapters that get their
  // summary for free, like a BigWig zoom record, ignore it.
  const opts = {
    bpPerPx,
    resolution,
    sources: sourcesArg,
    summaryScoreMode,
    scoreField,
    signal,
    statusCallback,
  }
  const [perSource, zoomRange, valueDomain] = await updateStatus(
    'Downloading wiggle data',
    statusCallback,
    () =>
      Promise.all([
        fetchSourceRaws(dataAdapter, regions, opts),
        dataAdapter.getZoomRange(opts),
        dataAdapter.getValueDomain(opts),
      ]),
  )
  checkAbortSignal(signal)

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
      ),
    })),
    zoomRange,
    ...(valueDomain ? { valueDomain } : {}),
  }))
  return rpcResult(results, collectWiggleTransferables(results))
}
