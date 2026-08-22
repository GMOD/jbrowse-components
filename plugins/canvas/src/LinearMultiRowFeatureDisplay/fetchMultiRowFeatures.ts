import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'
import { fetchEachRegion } from '@jbrowse/plugin-linear-genome-view'

import type { MultiRowGetFeaturesArgs } from '../MultiRowGetFeaturesRPC/rpcTypes.ts'
import type { RegionGateMeasurement } from '../shared/CanvasFeatureGateMixin.ts'
import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'
import type { Region } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type {
  GateFetchState,
  RegionFetchContext,
} from '@jbrowse/plugin-linear-genome-view'

type Needed = { region: Region; displayedRegionIndex: number }[]

// `IStateTreeNode`, never `IAnyStateTreeNode`: the latter resolves through
// `STNValue<any, …>` to `any`, so extending it silently turns off checking for
// every member below — a duck-typed contract that catches nothing is worse than
// no contract, since it reads as if it does. `IStateTreeNode` carries the same
// node-ness (it is what `IAnyStateTreeNode` is a wrapper for, and stays
// assignable to every `getSession`/`addDisposer`-style helper) while keeping the
// shape checked. Applies to every `interface …Self` in the repo.
interface FetchSelf extends IStateTreeNode {
  adapterConfig: Record<string, unknown>
  // The whole user-settings payload, never the individual slots: spreading it
  // is what keeps the bytes sent and the cache key they are stored under one
  // expression. Re-listing the fields here let the two drift — a field added to
  // only one side either never invalidates or refetches for nothing.
  //
  // Typed as the RPC's own fields rather than a loose bag, because the strict
  // arg type is load-bearing here: rpcTypes.ts deliberately omits
  // `maxFeatureDensity` so re-enabling that axis fails at the call site instead
  // of passing an argument the worker ignores. A `Record<string, unknown>`
  // spread would satisfy the call site and throw that away.
  rpcProps: () => Pick<
    MultiRowGetFeaturesArgs,
    'partitionField' | 'lengthField' | 'colorConfig'
  >
  resolvedByteLimit: () => number | undefined
  fetchRegions: (
    needed: Needed,
    work: (ctx: RegionFetchContext) => Promise<void>,
  ) => Promise<void>
  setRpcData: (regionIndex: number, data: MultiRowRegionData) => void
  gateFetchState: () => GateFetchState
  commitGateMeasurements: (
    measurements: RegionGateMeasurement[],
    issued: GateFetchState,
  ) => void
}

// Delegates to the shared fetchEachRegion primitive (per-region stale guards +
// fan-out). The MultiRowGetFeatures RPC folds the byte gate into the fetch
// (CanvasFeatureGateMixin supplies the budget), so a too-large region returns no
// payload and is skipped; onComplete commits the batch's measurements to the
// shared gate. Byte-only — the display turns the mixin's density axis off.
export function fetchMultiRowFeatures(self: FetchSelf, needed: Needed) {
  const byteLimit = self.resolvedByteLimit()
  // captured before the fetch, not at commit time
  const issued = self.gateFetchState()
  // Per-region gate measurements, keyed by the displayedRegionIndex onResult
  // reports back. A region whose fetch was skipped as stale never lands here.
  const gateResults = new Map<
    number,
    { bytes?: number; featureCount?: number }
  >()
  return fetchEachRegion(self, needed, {
    call: (region, ctx) =>
      ctx.callRpc('MultiRowGetFeatures', {
        adapterConfig: self.adapterConfig,
        region,
        byteLimit,
        ...self.rpcProps(),
      }),
    // `fetchEachRegion` marks the region loaded for us, and skips a refused one
    // — same `isRegionRefused` test as here, so what we store and what
    // `loadedRegions` claims cannot come apart.
    onResult: (idx, result) => {
      gateResults.set(idx, result)
      if (!isRegionRefused(result)) {
        self.setRpcData(idx, result)
      }
    },
    // Assembled from `needed` — which already carries each region's span — so
    // the region pairs with its result by construction instead of through a
    // second lookup that could miss.
    onComplete: () => {
      const measurements: RegionGateMeasurement[] = []
      for (const { region, displayedRegionIndex } of needed) {
        const result = gateResults.get(displayedRegionIndex)
        if (result) {
          measurements.push({ displayedRegionIndex, region, result })
        }
      }
      self.commitGateMeasurements(measurements, issued)
    },
  })
}
