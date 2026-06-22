import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import type { MafRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafSummaryRecord, Sample } from '../types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { FetchContext } from '@jbrowse/plugin-linear-genome-view'

interface MafFetchSelf extends IAnyStateTreeNode {
  adapterConfig: AnyConfigurationModel
  sources?: { name: string }[]
  fetchRegions: (
    needed: Needed,
    work: (ctx: FetchContext) => Promise<void>,
  ) => Promise<void>
  setRpcData: (regionIndex: number, data: MafRegionData) => void
  setSummaryData: (regionIndex: number, records: MafSummaryRecord[]) => void
  clearAlignmentData: () => void
  setSamples: (arg: {
    samples: Sample[]
    treeNewick: string | undefined
  }) => void
}

type Needed = { region: Region; displayedRegionIndex: number }[]

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
    const results = await Promise.all(
      needed.map(async ({ region, displayedRegionIndex }) => ({
        displayedRegionIndex,
        result: await call(region, ctx),
      })),
    )
    if (ctx.isStale()) {
      return
    }
    const first = results[0]
    if (first) {
      self.setSamples({
        samples: first.result.samples,
        treeNewick: first.result.treeNewick,
      })
    }
    commit(results)
  })
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
        region,
        // Display row order; the worker keys rowIndex off it (see rpcProps).
        orderedSampleIds: self.sources?.map(s => s.name),
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
        region,
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
