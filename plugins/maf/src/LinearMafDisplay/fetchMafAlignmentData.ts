import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import { getColorBaseMap } from '../LinearMafRenderer/util.ts'

import type { Sample } from './types.ts'
import type { LinearMafGetAlignmentDataResult } from '../LinearMafGetAlignmentData/LinearMafGetAlignmentData.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { FetchContext } from '@jbrowse/plugin-linear-genome-view'
import type { NewickNode } from '@jbrowse/tree-sidebar'

interface RpcProps {
  showAllLetters: boolean
  mismatchRendering: boolean
}

interface MafFetchSelf extends IAnyStateTreeNode {
  adapterConfig: AnyConfigurationModel
  rpcProps: () => RpcProps
  fetchRegions: (
    needed: { region: Region; displayedRegionIndex: number }[],
    work: (ctx: FetchContext) => Promise<void>,
  ) => Promise<void>
  setRpcData: (
    regionIndex: number,
    data: LinearMafGetAlignmentDataResult,
  ) => void
  setSamples: (arg: {
    samples: Sample[]
    tree: NewickNode | undefined
  }) => void
}

/**
 * Fetch alignment data for a set of buffered regions and commit results to
 * `rpcDataMap` via `setRpcData`. Each response also carries the canonical
 * `samples` + `tree` (derived server-side from track config), which we forward
 * to `setSamples` — that action is idempotent via deepEqual so calling it once
 * per region is fine. This unifies the formerly-separate `MafGetSamples` and
 * alignment fetches into a single call, eliminating the inter-fetch race
 * window and the need for an `afterCreate` setup autorun.
 *
 * `fetchRegions` (from `MultiRegionDisplayMixin`) handles stop-token rotation,
 * stale-fetch detection, and `setLoadedRegion` book-keeping.
 */
export async function fetchMafAlignmentData(
  self: MafFetchSelf,
  needed: { region: Region; displayedRegionIndex: number }[],
) {
  const { showAllLetters, mismatchRendering } = self.rpcProps()
  const adapterConfig = self.adapterConfig
  const { rpcManager } = getSession(self)
  const sessionId = getRpcSessionId(self)
  const colorForBase = getColorBaseMap(createJBrowseTheme())

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
            colorForBase,
            showAllLetters,
            mismatchRendering,
            stopToken: ctx.stopToken,
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
      self.setSamples({ samples: first.result.samples, tree: first.result.tree })
    }
    for (const { displayedRegionIndex, result } of results) {
      self.setRpcData(displayedRegionIndex, result)
    }
  })
}
