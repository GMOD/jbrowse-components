import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { callEachRegion } from '@jbrowse/plugin-linear-genome-view'

import type { MafRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafFrameRecord, MafSummaryRecord, Sample } from '../types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region, RpcStatus } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { FetchContext } from '@jbrowse/plugin-linear-genome-view'

interface MafFetchSelf extends IAnyStateTreeNode {
  adapterConfig: AnyConfigurationModel
  orderedSampleIds?: string[]
  annotationDataActive: boolean
  annotationAdapterConfig: Record<string, unknown> | undefined
  fetchRegions: (
    needed: Needed,
    work: (ctx: FetchContext) => Promise<void>,
  ) => Promise<void>
  makeRegionStatusCallback: (key: number) => (status: RpcStatus) => void
  setRpcData: (regionIndex: number, data: MafRegionData) => void
  setSummaryData: (regionIndex: number, records: MafSummaryRecord[]) => void
  setFramesData: (regionIndex: number, records: MafFrameRecord[]) => void
  clearAlignmentData: () => void
  setSamples: (arg: SampleSet) => void
}

type Needed = { region: Region; displayedRegionIndex: number }[]

interface SampleSet {
  samples: Sample[]
  treeNewick: string | undefined
  samplesCanonical: boolean
}

/**
 * Resolve the sample set this batch of per-region results reports, as the union
 * of their samples in first-seen (region) order.
 *
 * A sample-discovery track (no configured `samples`) derives its rows from the
 * genomes present in each region's blocks, so two regions can name different
 * sets and a region with no alignment blocks names none. Picking one region's
 * set to stand for the batch dropped the others' rows: the worker keys block
 * `rowIndex` off the client's order and drops samples missing from it, so a
 * genome only region B aligns rendered nothing. Unioning keeps every discovered
 * row, and being order-stable and additive it settles in one round instead of
 * flip-flopping the set (and `sampleSetGeneration` with it) as regions land in
 * different batches.
 *
 * `treeNewick` and `samplesCanonical` are config-derived, hence identical across
 * a batch — read from the first result. Configured-samples tracks return that
 * same complete set for every region, so the union is that set.
 */
export function unionSampleSets(
  results: readonly { result: SampleSet }[],
): SampleSet | undefined {
  const first = results[0]?.result
  // Map preserves first-insertion order while later fields (label/color) win.
  const byId = new Map<string, Sample>()
  for (const { result } of results) {
    for (const sample of result.samples) {
      byId.set(sample.id, sample)
    }
  }
  return first
    ? {
        samples: [...byId.values()],
        treeNewick: first.treeNewick,
        samplesCanonical: first.samplesCanonical,
      }
    : undefined
}

/**
 * Shared per-region fetch skeleton for both the detail and summary paths: call
 * one RPC per buffered region, bail on staleness, push the (config-derived)
 * `samples` + tree once, then hand the per-region results to `commit`.
 * `fetchRegions` (from `MultiRegionDisplayMixin`) owns stop-token rotation,
 * stale-fetch detection, and `loadedRegions` book-keeping.
 *
 * The RPC payload carries no color/style settings — worker output is purely
 * data-dependent and the main thread encodes from it plus `gpuProps()`, so
 * toggling colors/theme never refetches.
 *
 * `call` receives the region's `displayedRegionIndex` so it can key its
 * `statusCallback` off it — the parallel per-region fetches then aggregate into
 * one progress bar instead of clobbering each other.
 */
async function fetchMafRegions<R extends SampleSet>(
  self: MafFetchSelf,
  needed: Needed,
  call: (
    region: Region,
    ctx: FetchContext,
    displayedRegionIndex: number,
  ) => Promise<R>,
  commit: (results: { displayedRegionIndex: number; result: R }[]) => void,
) {
  await self.fetchRegions(needed, async (ctx: FetchContext) => {
    // The CDS-frame annotation overlay (when configured) fetches in the same
    // stop-token-guarded pass as the main data so the two share staleness +
    // loadedRegions book-keeping; the two RPCs run concurrently.
    const [results] = await Promise.all([
      callEachRegion(needed, ctx, call),
      fetchAnnotationData(self, needed, ctx),
    ])
    // One guard around the whole batch, not per region as in `fetchEachRegion`:
    // `setSamples` is a cross-region decision over `results`, so a partial
    // commit would publish a sample set derived from a superseded viewport.
    if (ctx.isStale()) {
      return
    }
    const sampleSet = unionSampleSets(results)
    if (sampleSet) {
      self.setSamples(sampleSet)
    }
    commit(results)
  })
}

/**
 * Fetch per-species CDS frame rows (UCSC `mafFrames`) for the buffered regions
 * from the MAF adapter's `annotationAdapter` sub-adapter, in parallel with the
 * main alignment/summary fetch and under its stop token. No-op when no adapter is
 * configured or neither the frame strip nor the codon view is on, so tracks
 * without frames pay nothing. Stale writes are skipped by `ctx.isStale()`.
 *
 * Fails soft: the overlay is auxiliary, so a frames-file error is logged but
 * swallowed rather than rejecting the combined fetch and blanking the alignment.
 */
async function fetchAnnotationData(
  self: MafFetchSelf,
  needed: Needed,
  ctx: FetchContext,
) {
  const adapterConfig = self.annotationAdapterConfig
  if (!self.annotationDataActive || !adapterConfig) {
    return
  }
  const { rpcManager } = getSession(self)
  const sessionId = getRpcSessionId(self)
  try {
    const results = await callEachRegion(needed, ctx, region =>
      rpcManager.call(sessionId, 'LinearMafGetAnnotationData', {
        adapterConfig,
        regions: [region],
        stopToken: ctx.stopToken,
      }),
    )
    if (!ctx.isStale()) {
      for (const { displayedRegionIndex, result } of results) {
        self.setFramesData(displayedRegionIndex, result.records)
      }
    }
  } catch (e) {
    if (!ctx.isStale()) {
      console.error('MAF CDS-frame annotation fetch failed', e)
    }
  }
}

export function fetchMafAlignmentData(self: MafFetchSelf, needed: Needed) {
  const { rpcManager } = getSession(self)
  const sessionId = getRpcSessionId(self)
  return fetchMafRegions(
    self,
    needed,
    (region, ctx, displayedRegionIndex) =>
      rpcManager.call(sessionId, 'LinearMafGetAlignmentData', {
        adapterConfig: self.adapterConfig,
        regions: [region],
        // Display row order; the worker keys rowIndex off it (see rpcProps).
        orderedSampleIds: self.orderedSampleIds,
        stopToken: ctx.stopToken,
        statusCallback: self.makeRegionStatusCallback(displayedRegionIndex),
      }),
    results => {
      for (const { displayedRegionIndex, result } of results) {
        self.setRpcData(displayedRegionIndex, result.regionData)
      }
    },
  )
}

/**
 * Zoom-out counterpart: pulls cheap per-species `bigMafSummary` rows instead of
 * full alignment sequence. Drops the alignment `rpcDataMap` so the GPU sequence
 * canvas paints nothing while the summary overlay draws the bars.
 */
export function fetchMafSummaryData(self: MafFetchSelf, needed: Needed) {
  const { rpcManager } = getSession(self)
  const sessionId = getRpcSessionId(self)
  return fetchMafRegions(
    self,
    needed,
    (region, ctx, displayedRegionIndex) =>
      rpcManager.call(sessionId, 'LinearMafGetSummaryData', {
        adapterConfig: self.adapterConfig,
        regions: [region],
        stopToken: ctx.stopToken,
        statusCallback: self.makeRegionStatusCallback(displayedRegionIndex),
      }),
    results => {
      self.clearAlignmentData()
      for (const { displayedRegionIndex, result } of results) {
        self.setSummaryData(displayedRegionIndex, result.records)
      }
    },
  )
}
