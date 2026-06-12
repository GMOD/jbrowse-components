import type { LinkedReadsMode } from './constants.ts'
import type { GroupedAlignmentsResult } from '../RenderAlignmentDataRPC/types.ts'

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
