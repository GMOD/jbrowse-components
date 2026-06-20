import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { FetchContext } from '@jbrowse/plugin-linear-genome-view'

type Needed = { region: Region; displayedRegionIndex: number }[]

interface FetchSelf extends IAnyStateTreeNode {
  adapterConfig: AnyConfigurationModel
  partitionField: string
  colorConfig: string
  fetchRegions: (
    needed: Needed,
    work: (ctx: FetchContext) => Promise<void>,
  ) => Promise<void>
  setRpcData: (regionIndex: number, data: MultiRowRegionData) => void
}

export function fetchMultiRowFeatures(self: FetchSelf, needed: Needed) {
  const { rpcManager } = getSession(self)
  const sessionId = getRpcSessionId(self)
  return self.fetchRegions(needed, async (ctx: FetchContext) => {
    const results = await Promise.all(
      needed.map(async ({ region, displayedRegionIndex }) => ({
        displayedRegionIndex,
        result: await rpcManager.call(sessionId, 'MultiRowGetFeatures', {
          sessionId,
          adapterConfig: self.adapterConfig,
          region,
          partitionField: self.partitionField,
          colorConfig: self.colorConfig,
          stopToken: ctx.stopToken,
        }),
      })),
    )
    if (ctx.isStale()) {
      return
    }
    for (const { displayedRegionIndex, result } of results) {
      self.setRpcData(displayedRegionIndex, result)
    }
  })
}
