import { getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { fetchEachRegion } from '@jbrowse/plugin-linear-genome-view'

import type { RegionGateMeasurement } from '../shared/CanvasFeatureGateMixin.ts'
import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region, RpcStatus } from '@jbrowse/core/util'
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
  resolvedByteLimit: () => number | undefined
  maxFeatureDensity: number | undefined
  fetchRegions: (
    needed: Needed,
    work: (ctx: FetchContext) => Promise<void>,
  ) => Promise<void>
  makeRegionStatusCallback: (key: number) => (status: RpcStatus) => void
  setRpcData: (regionIndex: number, data: MultiRowRegionData) => void
  commitGateMeasurements: (
    measurements: RegionGateMeasurement[],
    measuredSpanBp: number,
  ) => void
}

// Delegates to the shared fetchEachRegion primitive (per-region stale guards +
// fan-out). The MultiRowGetFeatures RPC folds the byte/density gate into the
// fetch (CanvasFeatureGateMixin supplies the budgets), so a too-large region
// returns no payload and is skipped; onComplete commits the batch's byte/density
// estimates to the shared gate.
export function fetchMultiRowFeatures(self: FetchSelf, needed: Needed) {
  const { rpcManager } = getSession(self)
  const sessionId = getRpcSessionId(self)
  const view = getContainingView(self) as LinearGenomeViewModel
  const bpPerPx = view.bpPerPx
  // captured before the fetch: the gate rescales the estimate from the span it
  // was measured over, so a mid-fetch zoom must not re-anchor it
  const measuredSpanBp = view.visibleBp
  const byteLimit = self.resolvedByteLimit()
  const maxFeatureDensity = self.maxFeatureDensity
  // Per-region gate measurements, keyed by the displayedRegionIndex onResult
  // reports back. A region whose fetch was skipped as stale never lands here.
  const gateResults = new Map<
    number,
    { bytes?: number; featureCount?: number }
  >()
  return fetchEachRegion(self, needed, {
    call: (region, ctx, displayedRegionIndex) =>
      rpcManager.call(sessionId, 'MultiRowGetFeatures', {
        adapterConfig: self.adapterConfig,
        region,
        bpPerPx,
        byteLimit,
        maxFeatureDensity,
        partitionField: self.partitionField,
        colorConfig: self.colorConfig,
        stopToken: ctx.stopToken,
        // keyed by region so the parallel per-region fetches aggregate into one
        // progress bar instead of clobbering each other
        statusCallback: self.makeRegionStatusCallback(displayedRegionIndex),
      }),
    onResult: (idx, result) => {
      gateResults.set(idx, result)
      if (!('regionTooLarge' in result)) {
        self.setRpcData(idx, result)
      }
    },
    // Assembled from `needed` — which already carries each region's span — so
    // the width pairs with the result by construction instead of through a
    // second lookup that could miss.
    onComplete: () => {
      const measurements: RegionGateMeasurement[] = []
      for (const { region, displayedRegionIndex } of needed) {
        const res = gateResults.get(displayedRegionIndex)
        if (res) {
          measurements.push({
            displayedRegionIndex,
            regionWidthBp: region.end - region.start,
            bytes: res.bytes,
            featureCount: res.featureCount,
          })
        }
      }
      self.commitGateMeasurements(measurements, measuredSpanBp)
    },
  })
}
