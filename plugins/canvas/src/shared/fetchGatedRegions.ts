import { fetchEachRegion } from '@jbrowse/display-kit/MultiRegionDisplayMixin'

import type { RegionGateMeasurement } from './CanvasFeatureGateMixin.ts'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'
import type { Region } from '@jbrowse/core/util'
import type {
  FetchContext,
  FetchEachRegionModel,
  IndexedRegion,
} from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import type { GateFetchState } from '@jbrowse/display-kit/regionTooLargeUtils'

interface GatedFetchModel extends FetchEachRegionModel {
  gateFetchState: () => GateFetchState
  commitGateMeasurements: (
    measurements: RegionGateMeasurement[],
    issued: GateFetchState,
  ) => void
}

/**
 * `fetchEachRegion` for a display whose feature RPC also measures **density**
 * (`CanvasFeatureGateMixin`). The byte axis needs nothing here — the helper
 * commits it for every display that passes a `byteLimit` — so what is left is
 * collecting each region's feature count, refused or not, and committing the
 * batch once the regions have landed.
 *
 * Collected in `call` rather than in `onResult`, because a refusal is exactly
 * the result the density axis wants: a region that short-circuited on the
 * feature count reports one, and `onResult` never sees it.
 */
export function fetchGatedRegions<
  Payload extends RegionGateMeasurement['result'],
>(
  self: GatedFetchModel,
  needed: IndexedRegion[],
  opts: {
    call: (
      region: Region,
      ctx: FetchContext,
    ) => Promise<Payload | RegionTooLargeResult>
    onResult: (
      displayedRegionIndex: number,
      result: Payload,
      region: Region,
    ) => void
  },
) {
  const results = new Map<number, Payload | RegionTooLargeResult>()
  return fetchEachRegion(self, needed, {
    call: async (region, ctx, displayedRegionIndex) => {
      const result = await opts.call(region, ctx)
      results.set(displayedRegionIndex, result)
      return result
    },
    onResult: (displayedRegionIndex, result: Payload) => {
      const { region } = needed.find(
        n => n.displayedRegionIndex === displayedRegionIndex,
      )!
      opts.onResult(displayedRegionIndex, result, region)
    },
    onComplete: issued => {
      self.commitGateMeasurements(
        needed.flatMap(({ region, displayedRegionIndex }) => {
          const result = results.get(displayedRegionIndex)
          return result ? [{ displayedRegionIndex, region, result }] : []
        }),
        issued,
      )
    },
  })
}
