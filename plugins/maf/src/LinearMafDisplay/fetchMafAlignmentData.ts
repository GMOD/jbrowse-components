import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import type { MafRegionData } from '../LinearMafRenderer/mafBackendTypes.ts'
import type { Sample } from '../types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { FetchContext } from '@jbrowse/plugin-linear-genome-view'

interface MafFetchSelf extends IAnyStateTreeNode {
  adapterConfig: AnyConfigurationModel
  samples: Sample[] | undefined
  fetchRegions: (
    needed: { region: Region; displayedRegionIndex: number }[],
    work: (ctx: FetchContext) => Promise<void>,
  ) => Promise<void>
  setRpcData: (regionIndex: number, data: MafRegionData) => void
  setSamples: (arg: {
    samples: Sample[]
    treeNewick: string | undefined
  }) => void
}

/**
 * Fetch alignment data for a set of buffered regions and commit results to
 * `rpcDataMap` via `setRpcData`. Each response also carries the canonical
 * `samples` + `tree` (derived server-side from track config), forwarded to
 * `setSamples` (idempotent via deepEqual). This unifies the formerly-separate
 * `MafGetSamples` and alignment fetches into a single call, eliminating the
 * inter-fetch race window.
 *
 * The RPC payload carries no color/style settings — worker output is purely
 * data-dependent and the main thread encodes GPU instances from this raw
 * data plus `gpuProps()`. Toggling colors / theme never refetches.
 *
 * `fetchRegions` (from `MultiRegionDisplayMixin`) handles stop-token rotation,
 * stale-fetch detection, and `setLoadedRegion` book-keeping.
 */
export async function fetchMafAlignmentData(
  self: MafFetchSelf,
  needed: { region: Region; displayedRegionIndex: number }[],
) {
  const adapterConfig = self.adapterConfig
  const { rpcManager } = getSession(self)
  const sessionId = getRpcSessionId(self)
  const { samples } = self

  await self.fetchRegions(needed, async (ctx: FetchContext) => {
    const results = await Promise.all(
      needed.map(async ({ region, displayedRegionIndex }) => {
        const result = await rpcManager.call(
          sessionId,
          'LinearMafGetAlignmentData',
          {
            sessionId,
            adapterConfig,
            region,
            stopToken: ctx.stopToken,
            samples,
          },
        )
        return { displayedRegionIndex, result }
      }),
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
    for (const { displayedRegionIndex, result } of results) {
      self.setRpcData(displayedRegionIndex, result.regionData)
    }
  })
}
