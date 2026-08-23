import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'
import { fetchEachRegion } from '@jbrowse/plugin-linear-genome-view'

import type { RegionGateMeasurement } from './CanvasFeatureGateMixin.ts'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'
import type { Region } from '@jbrowse/core/util'
import type {
  FetchContext,
  FetchEachRegionModel,
  GateFetchState,
} from '@jbrowse/plugin-linear-genome-view'

type IndexedRegion = { region: Region; displayedRegionIndex: number }

interface GatedFetchModel extends FetchEachRegionModel {
  gateFetchState: () => GateFetchState
  commitGateMeasurements: (
    measurements: RegionGateMeasurement[],
    issued: GateFetchState,
  ) => void
}

/**
 * `fetchEachRegion` for a display whose feature RPC carries its own byte and
 * density measurement (`CanvasFeatureGateMixin`). The gate state is captured
 * at issue, each region's measurement is collected as it lands whether or not
 * the worker refused it, and the batch commits to the gate once at the end —
 * a byte max across the batch, not a sum. `onResult` sees only the regions
 * that were not refused, so what the display stores and what `loadedRegions`
 * claims cannot come apart.
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
  const issued = self.gateFetchState()
  const results = new Map<number, Payload | RegionTooLargeResult>()
  return fetchEachRegion(self, needed, {
    call: opts.call,
    onResult: (displayedRegionIndex, result) => {
      results.set(displayedRegionIndex, result)
      if (!isRegionRefused(result)) {
        const { region } = needed.find(
          n => n.displayedRegionIndex === displayedRegionIndex,
        )!
        opts.onResult(displayedRegionIndex, result, region)
      }
    },
    onComplete: () => {
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
