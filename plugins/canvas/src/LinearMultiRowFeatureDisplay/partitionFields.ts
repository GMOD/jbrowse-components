import {
  AUTO_PARTITION_FIELD,
  MAX_COUNTED_PARTITION_VALUES,
} from '../MultiRowGetFeaturesRPC/packMultiRowFeatures.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

/**
 * The payloads the display holds, never the ones it draws: the density band
 * empties `drawnRegionData`, but the pin is a fact about fetches that landed.
 */
export interface PartitionFieldSlice {
  rpcDataMap: ReadonlyMap<number, MultiRowRegionData>
}

/**
 * The attribute a loaded region resolved its rows on, taken off the first
 * region that put something in a row rather than the first loaded region: an
 * empty region resolves nothing and falls through to the degenerate `name`,
 * which would pin every later region to tens of thousands of hairline rows.
 */
export function answeredPartitionField(self: PartitionFieldSlice) {
  return [...self.rpcDataMap.values()].find(
    data => data.partitionValues.length > 0,
  )?.resolvedPartitionField
}

/**
 * What a fetch issued now should partition on under auto. Unlike
 * `effectivePartitionField` there is no display default to fall back to — this
 * is an instruction to the worker, where "no instruction" is a real answer.
 */
export function pinnedPartitionField(self: PartitionFieldSlice) {
  return answeredPartitionField(self) ?? AUTO_PARTITION_FIELD
}

/**
 * The attribute names the loaded features carry, unioned across regions since
 * two regions can be served by adapters that saw different optional columns.
 */
export function partitionCandidates(self: PartitionFieldSlice) {
  const names = new Set<string>()
  for (const data of self.rpcDataMap.values()) {
    for (const name of data.partitionCandidates) {
      names.add(name)
    }
  }
  return [...names].sort()
}

/**
 * Whether a landed region agrees with the pin, or holds no row at all. A batch
 * fans out in parallel with nothing pinned, so two regions can come back
 * partitioned on different attributes; the disagreeing one is refetched with
 * the field spelled out, which terminates because the pin is itself some loaded
 * region's answer. An empty region is exempt — it has nothing to misplace.
 */
export function regionHasPinnedData(
  self: PartitionFieldSlice,
  displayedRegionIndex: number,
) {
  const data = self.rpcDataMap.get(displayedRegionIndex)
  return (
    data !== undefined &&
    (data.partitionValues.length === 0 ||
      data.resolvedPartitionField === pinnedPartitionField(self))
  )
}

export interface PartitionRowCount {
  count: number
  overflow: boolean
}

/**
 * How many rows partitioning on each candidate would draw. The worker ships
 * each region's distinct values capped, so a region that overflowed the cap
 * makes the whole union an overflow — its contribution is unknown.
 */
export function partitionRowCounts(self: PartitionFieldSlice) {
  const unions = new Map<string, Set<string>>()
  const overflowed = new Set<string>()
  for (const data of self.rpcDataMap.values()) {
    for (const { field, values, overflow } of data.partitionCandidateValues) {
      if (overflow) {
        overflowed.add(field)
      } else {
        const union = unions.get(field) ?? new Set<string>()
        for (const v of values) {
          union.add(v)
        }
        unions.set(field, union)
      }
    }
  }
  const counts = new Map<string, PartitionRowCount>()
  for (const [field, union] of unions) {
    counts.set(field, {
      count: union.size,
      overflow: union.size > MAX_COUNTED_PARTITION_VALUES,
    })
  }
  for (const field of overflowed) {
    counts.set(field, { count: MAX_COUNTED_PARTITION_VALUES, overflow: true })
  }
  return counts
}

/**
 * The aside on a "Partition by..." radio, or nothing while no loaded region has
 * counted it.
 */
export function partitionRowCountHint(rowCount: PartitionRowCount | undefined) {
  return rowCount === undefined
    ? undefined
    : rowCount.overflow
      ? `${MAX_COUNTED_PARTITION_VALUES}+ rows`
      : rowCount.count === 1
        ? '1 row'
        : `${rowCount.count} rows`
}
