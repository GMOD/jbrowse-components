import { fetchEachRegion } from '@jbrowse/display-kit/fetchEachRegion'

import type { RegionGateMeasurement } from './CanvasFeatureGateMixin.ts'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'
import type { Region } from '@jbrowse/core/util'
import type { FetchContext } from '@jbrowse/display-kit/FetchMixin'
import type { FetchEachRegionModel } from '@jbrowse/display-kit/fetchEachRegion'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'
import type { RegionPayload } from '@jbrowse/display-kit/regionCommit'
import type { GateFetchState } from '@jbrowse/display-kit/regionTooLargeUtils'

interface GatedFetchModel extends FetchEachRegionModel {
  commitGateMeasurements: (
    measurements: RegionGateMeasurement[],
    issued: GateFetchState,
  ) => void
}

/**
 * `fetchEachRegion` for a display whose feature RPC also measures density.
 * Collected in `call` rather than in `onResult`, because a refusal is exactly
 * the result the density axis wants and `onResult` never sees one.
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
    ) => RegionPayload
  },
) {
  const results = new Map<number, Payload | RegionTooLargeResult>()
  return fetchEachRegion(self, needed, {
    call: async (region, ctx, displayedRegionIndex) => {
      const result = await opts.call(region, ctx)
      results.set(displayedRegionIndex, result)
      return result
    },
    onResult: (displayedRegionIndex, result: Payload, region) =>
      opts.onResult(displayedRegionIndex, result, region),
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
