import { isCallbackValue } from '@jbrowse/core/configuration'

import {
  AUTO_PARTITION_FIELD,
  MAX_COUNTED_PARTITION_VALUES,
  resolvePartitionField,
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
 * `effectivePartitionField` this does not guess at what auto would pick — it is
 * an instruction to the worker, where "no instruction" is a real answer and the
 * worker is the side that knows which columns the data carries.
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
 * The attribute the rows are partitioned on: what a region answered, else what
 * the worker's own resolver would make of the slot. Answering through
 * `resolvePartitionField` rather than a second copy of its default is what
 * keeps the menu's checked radio and the clustering matrix naming the field the
 * next fetch would use.
 */
export function effectivePartitionField(
  self: PartitionFieldSlice & { partitionField: string },
) {
  return (
    answeredPartitionField(self) ??
    resolvePartitionField(self.partitionField, partitionCandidates(self))
  )
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

export const AUTO_CLUSTER_FIELD = 'auto'

// Either spelling of an attribute read inside a jexl color expression, matched
// as one alternation so the earliest of the two wins.
const COLOR_ATTRIBUTE =
  /get\(\s*feature\s*,\s*['"]([^'"]+)['"]\s*\)|\bfeature\.([A-Za-z_]\w*)/

function colorAttribute(colorConfig: string | undefined) {
  const match = isCallbackValue(colorConfig)
    ? COLOR_ATTRIBUTE.exec(colorConfig)
    : null
  return match ? (match[1] ?? match[2]) : undefined
}

/**
 * The attribute the rows cluster on. Under `auto` this follows the coloring —
 * a color expression reading an attribute is the user saying that attribute is
 * what the picture is about — and falls back to `name`, or to presence alone
 * where `name` is what the rows already are.
 */
export function resolveClusterField({
  clusterField,
  colorConfig,
  candidates,
  partitionField,
}: {
  clusterField: string
  colorConfig: string | undefined
  candidates: string[]
  partitionField: string
}) {
  if (clusterField !== AUTO_CLUSTER_FIELD) {
    return clusterField
  }
  const fromColor = colorAttribute(colorConfig)
  if (fromColor !== undefined && candidates.includes(fromColor)) {
    return fromColor
  }
  return candidates.includes('name') && partitionField !== 'name' ? 'name' : ''
}
