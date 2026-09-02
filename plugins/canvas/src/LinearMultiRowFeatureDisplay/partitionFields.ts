import {
  AUTO_PARTITION_FIELD,
  MAX_COUNTED_PARTITION_VALUES,
} from '../MultiRowGetFeaturesRPC/packMultiRowFeatures.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

/**
 * What the auto-partition questions are asked of: the payloads the display
 * HOLDS, never the ones it draws.
 *
 * The density band empties `drawnRegionData`, and none of this is about what is
 * drawn — the pin is a fact about the fetches that have landed, and the
 * reconciliation below compares a held payload against it.
 */
export interface PartitionFieldSlice {
  rpcDataMap: ReadonlyMap<number, MultiRowRegionData>
}

/**
 * The attribute a loaded region actually resolved its rows on, or undefined
 * while none has — the one answer `effectivePartitionField` and
 * `pinnedPartitionField` are two readings of.
 *
 * Off the first loaded region that PUT SOMETHING IN A ROW, rather than the
 * first loaded region: a region that came back empty resolved nothing.
 * `resolvePartitionField` collects its candidates off the features, so an empty
 * one falls through to the degenerate `name` — and pinned for the display that
 * is every later region partitioned by feature name, which on the RepeatMasker
 * files auto exists for is tens of thousands of one-feature hairline rows, a
 * "Partition by" radio checking a field nobody picked, and clustering keyed on
 * the same wrong attribute.
 *
 * Not a vote across the regions either: one file's columns are one file's
 * columns, and a region that disagreed is a different partition rather than a
 * tiebreak — which is why a disagreeing region is refetched (see
 * `regionHasPinnedData`) instead of being averaged in here.
 */
export function answeredPartitionField(self: PartitionFieldSlice) {
  return [...self.rpcDataMap.values()].find(
    data => data.partitionValues.length > 0,
  )?.resolvedPartitionField
}

/**
 * What a fetch issued NOW should partition on under auto: the attribute an
 * already-loaded region resolved, or auto again when none has. Unlike
 * `effectivePartitionField` there is no display default to fall back to — this
 * is an instruction to the worker, where "no instruction" is a real answer.
 */
export function pinnedPartitionField(self: PartitionFieldSlice) {
  return answeredPartitionField(self) ?? AUTO_PARTITION_FIELD
}

/**
 * The attribute names the loaded features carry, which is what the "Partition
 * by..." menu offers. Unioned across regions and re-sorted, since two regions
 * can be served by adapters that saw different optional columns.
 *
 * Empty until something is loaded, which is the menu's own disabled condition —
 * the names are discovered from the data rather than declared, the same way the
 * rows themselves are.
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
 * Whether a landed region holds data this display can draw, on the auto-
 * partition axis: it agrees with the pin, or it holds no row at all.
 *
 * Auto is resolved in the worker off a SAMPLE of the region it packs, and a
 * batch fans out in parallel with nothing pinned yet — so two regions of one
 * display can come back partitioned on different attributes, after which one
 * row name means two things and `sourcesWithoutLayout` unions both sets. A
 * region that answered something other than the pin has not stored data this
 * display can draw, so it is refetched, and this time it is TOLD the field. It
 * terminates because the worker echoes an explicit field back verbatim, and
 * because the pin is itself some loaded region's answer, so at least one region
 * always agrees.
 *
 * A region holding no row is exempt: it has nothing to land in the wrong one,
 * and refetching it would re-download every empty contig of a whole-genome load
 * to be told the same nothing.
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
 * How many rows partitioning on each candidate would draw, over the loaded
 * regions. The worker ships each region's distinct values (capped), and they
 * are unioned here because two regions of one file can each hold a different
 * subset of the same twenty repeat classes. A region that overflowed the cap
 * makes the union an overflow, since its contribution is unknown.
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
 * The aside on a "Partition by..." radio: how many rows the pick would draw
 * here, or nothing while no loaded region has counted it.
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
