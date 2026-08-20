import {
  downJunctionKeys,
  mergeJunctions,
} from '../features/sashimi/junctions.ts'
import {
  OVERFLOW_GROUP_KEY,
  compareGroupKeys,
  overflowLabel,
} from '../shared/groupFeatures.ts'
import { readIdAt } from '../shared/readIdentity.ts'
import { getOrCreate } from '../shared/util.ts'

import type {
  GroupedAlignmentsResult,
  WorkerPileupData,
} from '../RenderAlignmentDataRPC/types.ts'
import type { RegionJunctions } from '../features/sashimi/junctions.ts'
import type { SashimiArcsMode } from './constants.ts'

// The "this display hides no lane" answer, shared so every `hiddenGroupKeys`
// getter returns one identity — a fresh `new Set()` per evaluation reruns
// `groupOrder`, `rawDataByGroup` and `readIdIndexMap` on any invalidation.
export const NO_HIDDEN_GROUPS: ReadonlySet<string> = new Set()

// The one place the `rpcDataMap` → groups nested walk is spelled; every scan
// below and the model's `.some`/max getters iterate it rather than re-nesting
// the two loops. Yields in worker emit order, an ungrouped fetch being the
// single-group ('') case per region.
//
// `hidden` is the display's `hiddenGroupKeys`, so a dropped lane stays out of
// the derivations shared across the visible ones (coverage domain, color legend,
// sashimi strip).
export function* eachGroup(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
  hidden: ReadonlySet<string> = NO_HIDDEN_GROUPS,
) {
  for (const [displayedRegionIndex, grouped] of rpcDataMap) {
    for (const { key, label, data, mergedKeys } of grouped.groups) {
      if (!hidden.has(key)) {
        yield { displayedRegionIndex, key, label, data, mergedKeys }
      }
    }
  }
}

export interface SashimiSidesOpts {
  minSashimiScore: number
  mode: SashimiArcsMode
  // refName of the region each `rpcDataMap` key was fetched from — the display
  // reads it off `loadedRegions`, which is keyed the same way and updates with
  // the fetch, not with pan. Required rather than defaulted: without it every
  // chromosome on screen shares one bp number line, and junctions on different
  // ones read as interleaving.
  refNameFor: (displayedRegionIndex: number) => string
  hidden?: ReadonlySet<string>
}

// Per group, which of its junctions land in the strip below coverage, keyed by
// `junctionKey`. Two questions come off this one scan, and sharing the set is
// what makes them agree: the LAYOUT asks whether a lane needs the strip reserved
// at all (a non-empty set), and the OVERLAY asks which side to draw each arc on.
// The down sub-band renders at `sashimiArcsHeight` whether or not the layout
// reserved it, so any under-reserving disagreement paints arcs over the pileup.
//
// Genomic-bp over every *loaded* region, so the layout keeps depending only on
// `rpcDataMap`: projecting to screen px would re-lay-out the pileup on every pan
// frame and flip an arc between bands as regions scroll in and out of view.
// Interleaving survives any monotonic projection, so the answer is the same.
export function buildSashimiDownKeys(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
  opts: SashimiSidesOpts,
) {
  const { minSashimiScore, mode, refNameFor, hidden } = opts
  const out = new Map<string, ReadonlySet<string>>()
  for (const [key, regions] of sashimiRegionsByGroup(
    rpcDataMap,
    refNameFor,
    hidden,
  )) {
    // 'auto' pools a group's junctions across its regions before assigning
    // sides, so the merge pools the same way — a pair interleaving across two
    // collapsed-intron regions of one group still reserves the strip.
    const merged = mergeJunctions(regions, minSashimiScore)
    out.set(key, downJunctionKeys(merged.values(), mode))
  }
  return out
}

// Each group's per-region sashimi arrays, tagged with the refName they were
// fetched from.
function sashimiRegionsByGroup(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
  refNameFor: (displayedRegionIndex: number) => string,
  hidden?: ReadonlySet<string>,
) {
  const byGroup = new Map<string, RegionJunctions[]>()
  for (const { displayedRegionIndex, key, data } of eachGroup(
    rpcDataMap,
    hidden,
  )) {
    getOrCreate(byGroup, key, () => []).push({
      refName: refNameFor(displayedRegionIndex),
      data,
    })
  }
  return byGroup
}

// A group's stable identity: its sort key and human-readable label.
export interface GroupId {
  key: string
  label: string
}

// Whether the fetch produced NAMED sections, and so whether to draw the section
// labels + dividers. Reads the data rather than the `groupBy` setting: chain mode
// degrades a per-read dimension to one unnamed section while `groupBy` stays set
// (`groupByForMode`), so the setting labels that degraded section "ungrouped".
// Every real dimension names even its catch-all bucket ('HP: none', 'No
// orientation'), which makes a non-empty label the reliable signal.
//
// Distinct from the model's `isGrouped` (>1 section), which is about the scroll
// model: grouping that yields a single section still wants its label.
export function hasNamedGroups(order: readonly GroupId[]) {
  return order.some(g => g.label !== '')
}

// Ordered, de-duplicated group identities across every fetched region, by the
// same `compareGroupKeys` the worker's per-region partition uses. Membership,
// order and labels are a property of the *fetch*, so deriving them straight from
// `rpcDataMap` keeps them stable across every relayout (sortedBy / softclip /
// per-group height drag) rather than recomputing them in the layout pass.
//
// The explicit re-sort is load-bearing across regions: the worker sorts each
// region on its own, and a first-seen merge would order the union by which
// region exhibited each key first — a group absent from an early region (a
// chromosome with only reverse-strand reads) sorting ahead of one it should
// follow, or an untagged group escaping last, purely from fetch layout.
//
// `hidden` drops here rather than in the caller, for the reason
// `buildRawDataByGroup` gives: this is what `groupOrder` IS, and every other
// per-group collection is keyed by that already-filtered set.
export function orderedGroups(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
  hidden?: ReadonlySet<string>,
): GroupId[] {
  const order = new Map<string, GroupId>()
  // The overflow lane is the one whose label a single region cannot answer for:
  // `MAX_GROUPS` is enforced per worker call, so each region merges whatever its
  // own tail was and the DRAWN lane holds the union. First-seen-wins named it for
  // whichever region happened to arrive first — "8 more values" over a lane
  // holding 15. Unioned here, where every other cross-region answer about group
  // identity is already resolved.
  const merged = new Set<string>()
  for (const { key, label, mergedKeys } of eachGroup(rpcDataMap, hidden)) {
    if (mergedKeys) {
      for (const k of mergedKeys) {
        merged.add(k)
      }
    }
    if (!order.has(key)) {
      order.set(key, { key, label })
    }
  }
  const overflow = order.get(OVERFLOW_GROUP_KEY)
  if (overflow) {
    overflow.label = overflowLabel(merged.size)
  }
  return [...order.values()].sort((a, b) => compareGroupKeys(a.key, b.key))
}

// The per-read lookups below scan every group of every fetched region. They live
// here rather than in the model so the O(reads) scans stay pure and testable;
// the model exposes them as memoized getters over `rpcDataMap`.

// chain name → the read ids belonging to that chain, across all groups/regions.
// Empty outside chain mode, where reads carry a `readChainIndices` entry into
// the per-fetch `chainNames`. Keyed by the globally-unique chain NAME: chainIdx
// is assigned per worker call (per region, and per group), so the same integer
// means different chains across calls and keying by it merges unrelated ones.
export function buildReadIdsByChainName(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
  chainMode: boolean,
  hidden?: ReadonlySet<string>,
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  if (chainMode) {
    for (const { data } of eachGroup(rpcDataMap, hidden)) {
      if (data.readChainIndices && data.chainNames) {
        for (let i = 0; i < data.readKeys.length; i++) {
          const name = data.chainNames[data.readChainIndices[i]!]
          const id = readIdAt(data, i)
          if (name !== undefined && id !== undefined) {
            getOrCreate(map, name, () => []).push(id)
          }
        }
      }
    }
  }
  return map
}

// Regroup the fetched `rpcDataMap` (region idx → grouped result) into group key
// → region idx → raw data. The arc compute (`computeArcsFromPileupData`) takes
// one of these per-group maps, which is what lets arcs run per group.
//
// `hidden` drops HERE, not in each consumer, and that is the point: the per-lane
// consumers look a key up by an already-filtered `groupOrder` and never noticed,
// while the cross-group walks (`derivativePathCandidates`, the arc scale pooling)
// each had to remember the rule — and one didn't, ranking derivative-allele paths
// on chains from a lane the display never draws. `rpcDataMap` stays the
// unfiltered escape hatch for anything that genuinely wants every lane.
//
// Key order is first-seen-across-regions, NOT the stacking order — the very case
// `orderedGroups` re-sorts to fix. Every consumer looks a key up by `groupOrder`,
// so nothing depends on this map's iteration order; don't start.
export function buildRawDataByGroup(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
  hidden?: ReadonlySet<string>,
): Map<string, Map<number, WorkerPileupData>> {
  const out = new Map<string, Map<number, WorkerPileupData>>()
  for (const { displayedRegionIndex, key, data } of eachGroup(
    rpcDataMap,
    hidden,
  )) {
    getOrCreate(out, key, () => new Map()).set(displayedRegionIndex, data)
  }
  return out
}

// Read id → which lane, which region, and which slot in that region's per-read
// arrays, so a hit-test or detail lookup can resolve a feature back to them.
// `findRead` (readLookup.ts) turns one of these entries into the read's data.
export type ReadIdIndexMap = Map<
  string,
  { displayedRegionIndex: number; groupKey: string; idx: number }
>

// Hidden lanes drop here for `buildRawDataByGroup`'s reason plus one of its own:
// `findRead` resolves an entry through `laidOutByGroup`, built from the already
// filtered `groupOrder`, so a hidden lane's entries were unreachable by
// construction — and each cost a `readIdAt` string no lookup can reach.
export function buildReadIdIndexMap(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
  hidden?: ReadonlySet<string>,
): ReadIdIndexMap {
  const map: ReadIdIndexMap = new Map()
  for (const { displayedRegionIndex, key, data } of eachGroup(
    rpcDataMap,
    hidden,
  )) {
    for (let i = 0; i < data.readKeys.length; i++) {
      const id = readIdAt(data, i)
      if (id !== undefined) {
        map.set(id, { displayedRegionIndex, groupKey: key, idx: i })
      }
    }
  }
  return map
}
