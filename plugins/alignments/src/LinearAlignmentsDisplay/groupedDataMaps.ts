import { compareGroupKeys } from '../shared/groupFeatures.ts'

import type { LinkedReadsMode } from './constants.ts'
import type {
  GroupedAlignmentsResult,
  PileupDataResult,
} from '../RenderAlignmentDataRPC/types.ts'

// Get the entry for `key`, lazily creating + inserting it on first miss — the
// shared shape of every accumulation below (a Map of arrays or of nested Maps).
function getOrCreate<K, V>(map: Map<K, V>, key: K, make: () => V): V {
  let value = map.get(key)
  if (value === undefined) {
    value = make()
    map.set(key, value)
  }
  return value
}

// The one place the `rpcDataMap` → groups nested walk is spelled. Every scan
// below (and the model's `.some`/max getters) iterates this generator instead of
// re-nesting the two loops, so the traversal shape lives in exactly one spot.
// Yields each group's region index, identity (key/label), and data in worker
// emit order; ungrouped fetches are the single-group ('') case per region.
export function* eachGroup(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
) {
  for (const [displayedRegionIndex, grouped] of rpcDataMap) {
    for (const { key, label, data } of grouped.groups) {
      yield { displayedRegionIndex, key, label, data }
    }
  }
}

// Just the per-region data, for scans that don't care about region/group
// identity (coverage/insert-size maxima, color legend categories).
export function* eachGroupData(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
) {
  for (const { data } of eachGroup(rpcDataMap)) {
    yield data
  }
}

// Short-circuiting `.some` over every group's data — stops at the first match
// without materializing the generator into an array (`[...eachGroupData()]`).
export function someGroupData(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
  predicate: (data: PileupDataResult) => boolean,
) {
  for (const data of eachGroupData(rpcDataMap)) {
    if (predicate(data)) {
      return true
    }
  }
  return false
}

// True when any loaded region/group has a sashimi junction passing
// `minSashimiScore`. Shared by the `hasSashimiArcs` getter and the
// fit-to-viewport band-overhead calc, which runs in an earlier `.views` block
// than that getter and so can't read it.
export function anyGroupHasSashimi(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
  minSashimiScore: number,
) {
  return someGroupData(rpcDataMap, d =>
    d.sashimiCounts.some(c => c >= minSashimiScore),
  )
}

// A group's stable identity: its sort key and human-readable label.
export interface GroupId {
  key: string
  label: string
}

// Ordered, de-duplicated group identities across every fetched region, sorted
// (untagged-key '' last) by the same `compareGroupKeys` the worker's per-region
// partition uses. Group membership, order, and labels are a property of the
// *fetch*, not of layout — deriving them straight from `rpcDataMap` keeps the
// order stable across every main-thread relayout (sortedBy / softclip /
// per-group height drag) and gives the whole model one source of truth for it,
// rather than recomputing it inside the layout pass (`buildLaidOutByGroup`) and
// again as `buildRawDataByGroup`'s key order.
//
// The explicit re-sort is load-bearing across regions: the worker sorts each
// region's groups on its own, but a plain first-seen merge would order the
// union by which region first exhibited each key. A group absent from an early
// region (e.g. a chromosome with only reverse-strand reads) would then sort
// ahead of one it should follow — and an untagged group could escape last —
// purely from fetch layout. Sorting the merged set restores the intended order.
export function orderedGroups(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
): GroupId[] {
  const order = new Map<string, GroupId>()
  for (const { key, label } of eachGroup(rpcDataMap)) {
    if (!order.has(key)) {
      order.set(key, { key, label })
    }
  }
  return [...order.values()].sort((a, b) => compareGroupKeys(a.key, b.key))
}

// Per-read lookups derived by scanning every group of every fetched region.
// Pulled out of the model so the O(reads) scans are pure + unit-testable; the
// model exposes them as memoized getters over `rpcDataMap`.

// chain name → the read ids belonging to that chain, across all groups/regions.
// Empty unless chain (linked-reads) mode is active, where reads carry a
// `readChainIndices` entry into the per-fetch `chainNames`. Keyed by the
// globally-unique chain name, not the raw chainIdx: chainIdx is assigned per
// worker call (per region, and now per group), so the same integer means
// different chains across calls — keying by index would merge unrelated chains.
export function buildChainIdMap(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
  linkedReads: LinkedReadsMode,
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  if (linkedReads !== 'off') {
    for (const { data } of eachGroup(rpcDataMap)) {
      if (data.readChainIndices && data.chainNames) {
        for (let i = 0; i < data.readIds.length; i++) {
          const name = data.chainNames[data.readChainIndices[i]!]
          const id = data.readIds[i]
          if (name !== undefined && id !== undefined) {
            getOrCreate(map, name, () => []).push(id)
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
  for (const { displayedRegionIndex, key, data } of eachGroup(rpcDataMap)) {
    getOrCreate(out, key, () => new Map()).set(displayedRegionIndex, data)
  }
  return out
}

// read id → where that read lives (which region, which group, row index),
// letting hit-test/detail lookups resolve a feature back to its raw arrays.
export function buildReadIdIndexMap(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
): Map<
  string,
  { displayedRegionIndex: number; groupKey: string; idx: number }
> {
  const map = new Map<
    string,
    { displayedRegionIndex: number; groupKey: string; idx: number }
  >()
  for (const { displayedRegionIndex, key, data } of eachGroup(rpcDataMap)) {
    for (let i = 0; i < data.readIds.length; i++) {
      const id = data.readIds[i]
      if (id !== undefined) {
        map.set(id, { displayedRegionIndex, groupKey: key, idx: i })
      }
    }
  }
  return map
}
