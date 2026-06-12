import type { LinkedReadsMode } from './constants.ts'
import type {
  GroupedAlignmentsResult,
  PileupDataResult,
} from '../RenderAlignmentDataRPC/types.ts'

// Every group's per-region data across all fetched regions, in worker order.
// Ungrouped fetches yield one entry per region; the single nested traversal of
// `rpcDataMap` → groups → data lives here instead of being re-spelled at each
// `.some`/max scan in the model.
export function* eachGroupData(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
) {
  for (const grouped of rpcDataMap.values()) {
    for (const { data } of grouped.groups) {
      yield data
    }
  }
}

// Per-read lookups derived by scanning every group of every fetched region.
// Pulled out of the model so the O(reads) scans are pure + unit-testable; the
// model exposes them as memoized getters over `rpcDataMap`.

// chainIdx → the read ids belonging to that chain, across all groups/regions.
// Empty unless chain (linked-reads) mode is active, where reads carry a
// `readChainIndices` entry grouping them into chains by name.
export function buildChainIdMap(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
  linkedReads: LinkedReadsMode,
): Map<number, string[]> {
  const map = new Map<number, string[]>()
  if (linkedReads !== 'off') {
    for (const grouped of rpcDataMap.values()) {
      for (const { data } of grouped.groups) {
        if (data.readChainIndices) {
          for (let i = 0; i < data.readIds.length; i++) {
            const chainIdx = data.readChainIndices[i]!
            let ids = map.get(chainIdx)
            if (!ids) {
              ids = []
              map.set(chainIdx, ids)
            }
            const id = data.readIds[i]
            if (id !== undefined) {
              ids.push(id)
            }
          }
        }
      }
    }
  }
  return map
}

// Regroup the fetched `rpcDataMap` (region idx → grouped result) into one raw
// region map per group key (group key → region idx → that group's raw data).
// Insertion order follows the worker's group order, so the first key is the
// primary group — the same `groups[0]` slice the ungrouped arc/sashimi feeds
// read. The arc compute (`computeArcsFromPileupData`) consumes one of these
// per-group maps, so this is what lets arcs run per group.
export function buildRawDataByGroup(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
): Map<string, Map<number, PileupDataResult>> {
  const out = new Map<string, Map<number, PileupDataResult>>()
  for (const [idx, grouped] of rpcDataMap) {
    for (const { key, data } of grouped.groups) {
      let regionMap = out.get(key)
      if (!regionMap) {
        regionMap = new Map<number, PileupDataResult>()
        out.set(key, regionMap)
      }
      regionMap.set(idx, data)
    }
  }
  return out
}

// read id → where that read lives (which region, which group, row index),
// letting hit-test/detail lookups resolve a feature back to its raw arrays.
export function buildReadIdIndexMap(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
): Map<string, { displayedRegionIndex: number; groupKey: string; idx: number }> {
  const map = new Map<
    string,
    { displayedRegionIndex: number; groupKey: string; idx: number }
  >()
  for (const [displayedRegionIndex, grouped] of rpcDataMap) {
    for (const { key, data } of grouped.groups) {
      for (let i = 0; i < data.readIds.length; i++) {
        const id = data.readIds[i]
        if (id !== undefined) {
          map.set(id, { displayedRegionIndex, groupKey: key, idx: i })
        }
      }
    }
  }
  return map
}
