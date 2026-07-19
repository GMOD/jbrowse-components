import { getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { fetchEachRegion } from '@jbrowse/plugin-linear-genome-view'

import type { FeatureGateRegionResult } from '../shared/CanvasFeatureGateMixin.ts'
import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type {
  FetchContext,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type Needed = { region: Region; displayedRegionIndex: number }[]

interface FetchSelf extends IAnyStateTreeNode {
  adapterConfig: AnyConfigurationModel
  partitionField: string
  colorConfig: string | undefined
  byteSizeLimit: () => number | undefined
  maxFeatureDensity: number | undefined
  fetchRegions: (
    needed: Needed,
    work: (ctx: FetchContext) => Promise<void>,
  ) => Promise<void>
  setRpcData: (regionIndex: number, data: MultiRowRegionData) => void
  commitFeatureGateStats: (results: FeatureGateRegionResult[]) => void
}

// Delegates to the shared fetchEachRegion primitive (per-region stale guards +
// fan-out). The MultiRowGetFeatures RPC folds the byte/density gate into the
// fetch (CanvasFeatureGateMixin supplies the budgets), so a too-large region
// returns no payload and is skipped; onComplete commits the batch's byte/density
// estimates to the shared gate.
export function fetchMultiRowFeatures(self: FetchSelf, needed: Needed) {
  const { rpcManager } = getSession(self)
  const sessionId = getRpcSessionId(self)
  const bpPerPx = (getContainingView(self) as LinearGenomeViewModel).bpPerPx
  const byteSizeLimit = self.byteSizeLimit()
  const maxFeatureDensity = self.maxFeatureDensity
  const widthByIndex = new Map(
    needed.map(n => [n.displayedRegionIndex, n.region.end - n.region.start]),
  )
  const gateResults: FeatureGateRegionResult[] = []
  return fetchEachRegion(self, needed, {
    call: (region, ctx) =>
      rpcManager.call(sessionId, 'MultiRowGetFeatures', {
        adapterConfig: self.adapterConfig,
        region,
        bpPerPx,
        byteSizeLimit,
        maxFeatureDensity,
        partitionField: self.partitionField,
        colorConfig: self.colorConfig,
        stopToken: ctx.stopToken,
      }),
    onResult: (idx, result) => {
      gateResults.push({
        displayedRegionIndex: idx,
        regionWidthBp: widthByIndex.get(idx) ?? 0,
        bytes: result.bytes,
        featureCount: result.featureCount,
      })
      if (!('regionTooLarge' in result)) {
        self.setRpcData(idx, result)
      }
    },
    onComplete: () => {
      self.commitFeatureGateStats(gateResults)
    },
  })
}
