import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { fetchEachRegion } from '@jbrowse/plugin-linear-genome-view'

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

// Delegates to the shared fetchEachRegion primitive (per-region stale guards +
// fan-out); the only display-specific bits are the typed MultiRowGetFeatures
// call closure and setRpcData commit.
export function fetchMultiRowFeatures(self: FetchSelf, needed: Needed) {
  const { rpcManager } = getSession(self)
  const sessionId = getRpcSessionId(self)
  return fetchEachRegion(self, needed, {
    call: (region, ctx) =>
      rpcManager.call(sessionId, 'MultiRowGetFeatures', {
        sessionId,
        adapterConfig: self.adapterConfig,
        region,
        partitionField: self.partitionField,
        colorConfig: self.colorConfig,
        stopToken: ctx.stopToken,
      }),
    onResult: (idx, result) => {
      self.setRpcData(idx, result)
    },
  })
}
