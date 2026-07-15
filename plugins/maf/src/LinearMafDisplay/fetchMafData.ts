import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import type { MafRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafFrameRecord, MafSummaryRecord, Sample } from '../types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
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
  setRpcData: (regionIndex: number, data: MafRegionData) => void
  setSummaryData: (regionIndex: number, records: MafSummaryRecord[]) => void
  setFramesData: (regionIndex: number, records: MafFrameRecord[]) => void
  clearAlignmentData: () => void
  setSamples: (arg: {
    samples: Sample[]
    treeNewick: string | undefined
  }) => void
}

type Needed = { region: Region; displayedRegionIndex: number }[]

/**
 * Choose which per-region result defines the display's sample set. A
 * sample-discovery track (no configured `samples`) derives its rows from the
 * genomes present in each region's blocks, so a region with no alignment blocks
 * yields zero samples — letting that empty region define the set would blank the
 * rows and churn `orderedSampleIds` (→ needless refetch). Prefer the first region
 * that actually discovered samples; fall back to the first result only when every
 * buffered region is empty (an all-gap viewport, where an empty set is correct).
 * Configured-samples tracks return the same non-empty set for every region, so
 * this resolves to the first result for them.
 */
export function pickSamplesResult<R extends { samples: Sample[] }>(
  results: readonly { result: R }[],
): R | undefined {
  return (
    results.find(r => r.result.samples.length > 0)?.result ?? results[0]?.result
  )
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
 */
async function fetchMafRegions<
  R extends { samples: Sample[]; treeNewick: string | undefined },
>(
  self: MafFetchSelf,
  needed: Needed,
  call: (region: Region, ctx: FetchContext) => Promise<R>,
  commit: (results: { displayedRegionIndex: number; result: R }[]) => void,
) {
  await self.fetchRegions(needed, async (ctx: FetchContext) => {
    // The CDS-frame annotation overlay (when configured) fetches in the same
    // stop-token-guarded pass as the main data so the two share staleness +
    // loadedRegions book-keeping; the two RPCs run concurrently.
    const [results] = await Promise.all([
      Promise.all(
        needed.map(async ({ region, displayedRegionIndex }) => ({
          displayedRegionIndex,
          result: await call(region, ctx),
        })),
      ),
      fetchAnnotationData(self, needed, ctx),
    ])
    if (ctx.isStale()) {
      return
    }
    const first = pickSamplesResult(results)
    if (first) {
      self.setSamples({
        samples: first.samples,
        treeNewick: first.treeNewick,
      })
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
    const results = await Promise.all(
      needed.map(async ({ region, displayedRegionIndex }) => ({
        displayedRegionIndex,
        records: (
          await rpcManager.call(sessionId, 'LinearMafGetAnnotationData', {
            adapterConfig,
            regions: [region],
            stopToken: ctx.stopToken,
          })
        ).records,
      })),
    )
    if (!ctx.isStale()) {
      for (const { displayedRegionIndex, records } of results) {
        self.setFramesData(displayedRegionIndex, records)
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
    (region, ctx) =>
      rpcManager.call(sessionId, 'LinearMafGetAlignmentData', {
        adapterConfig: self.adapterConfig,
        regions: [region],
        // Display row order; the worker keys rowIndex off it (see rpcProps).
        orderedSampleIds: self.orderedSampleIds,
        stopToken: ctx.stopToken,
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
    (region, ctx) =>
      rpcManager.call(sessionId, 'LinearMafGetSummaryData', {
        adapterConfig: self.adapterConfig,
        regions: [region],
        stopToken: ctx.stopToken,
      }),
    results => {
      self.clearAlignmentData()
      for (const { displayedRegionIndex, result } of results) {
        self.setSummaryData(displayedRegionIndex, result.records)
      }
    },
  )
}
