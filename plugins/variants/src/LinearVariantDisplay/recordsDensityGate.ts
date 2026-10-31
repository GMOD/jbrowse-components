import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'

import type {
  CellDataResult,
  RecordsTooDenseResult,
} from '../VariantRPC/executeVariantCellData.ts'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'
import type { RegionGateMeasurement } from '@jbrowse/plugin-features/band'

function isRecordsTooDense(
  result: RegionTooLargeResult,
): result is RecordsTooDenseResult {
  return 'recordCounts' in result
}

/**
 * A cell fetch's record counts as `FeatureGateMixin` measurements, one per
 * region the fetch was issued for, from a payload or a density refusal alike.
 * A byte refusal, or a columns payload, counted nothing.
 */
export function recordCountMeasurements(
  regions: IndexedRegion[],
  result: CellDataResult | RegionTooLargeResult,
): RegionGateMeasurement[] {
  const counts =
    !isRegionRefused(result) || isRecordsTooDense(result)
      ? result.recordCounts
      : []
  return regions.map(({ region, displayedRegionIndex }, i) => ({
    displayedRegionIndex,
    region,
    result: { featureCount: counts[i] },
  }))
}
