import {
  downJunctionKeys,
  mergeJunctions,
} from '../features/sashimi/junctions.ts'
import { compareGroupKeys } from '../shared/groupFeatures.ts'
import { readIdAt } from '../shared/readIdentity.ts'
import { getOrCreate } from '../shared/util.ts'

import type {
  GroupedAlignmentsResult,
  WorkerPileupData,
} from '../RenderAlignmentDataRPC/types.ts'
import type { RegionJunctions } from '../features/sashimi/junctions.ts'
import type { SashimiArcsMode } from './constants.ts'

// The one place the `rpcDataMap` → groups nested walk is spelled. Every scan
// below (and the model's `.some`/max getters) iterates this generator instead of
// re-nesting the two loops, so the traversal shape lives in exactly one spot.
// Yields each group's region index, identity (key/label), and data in worker
// emit order; ungrouped fetches are the single-group ('') case per region.
//
// `hidden` is the display's `hiddenGroupKeys`, so a lane it drops stays out of
// the derivations shared across the visible lanes (coverage domain, color
// legend, sashimi strip). Defaults to hiding nothing, which is what the
// per-group regroupers below want — they're looked up by `groupOrder` key.
export function* eachGroup(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
  hidden: ReadonlySet<string> = NOTHING_HIDDEN,
) {
  for (const [displayedRegionIndex, grouped] of rpcDataMap) {
    for (const { key, label, data } of grouped.groups) {
      if (!hidden.has(key)) {
        yield { displayedRegionIndex, key, label, data }
      }
    }
  }
}

const NOTHING_HIDDEN: ReadonlySet<string> = new Set()

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
// `junctionKey`. Two questions come off this one scan:
//
//   - the LAYOUT asks whether a lane needs the strip reserved at all (a
//     non-empty set), so a grouping where only one lane has junctions doesn't
//     hand every other lane an empty strip — the arc band's `hasArcs` does the
//     same for read connections;
//   - the OVERLAY asks which side to draw each arc on, by looking its junction
//     up in the matching group's set.
//
// Sharing the set is what makes those agree. They used to be separate passes
// over overlapping data (this one genomic and per-loaded-region, the geometry's
// screen-space and per-visible-region), and the down sub-band renders at
// `sashimiArcsHeight` whether or not the layout reserved it — so any
// disagreement in the under-reserving direction painted arcs over the pileup.
//
// Deliberately genomic-bp, over every *loaded* region, so the layout keeps
// depending only on `rpcDataMap` — projecting to screen px would make the pileup
// re-lay-out on every pan frame, and would flip an arc between bands as regions
// scroll in and out of view. Interleaving survives any monotonic projection, so
// this is the same answer a screen-space assignment reaches.
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

// Whether the fetch actually produced NAMED sections, i.e. whether to draw the
// section labels + dividers. Deliberately reads the data, not the `groupBy`
// setting: an ungrouped fetch is one group keyed '' with an empty label, and chain
// mode with a per-read dimension degrades to exactly that in the worker (see
// `groupByForMode`) while `groupBy` stays set — so keying off the setting labelled
// that degraded single section "ungrouped". Every real dimension names even its
// catch-all bucket ('HP: none', 'No orientation', 'MAPQ unavailable'), so a
// non-empty label is the reliable signal that grouping is in effect.
//
// Distinct from the model's `isGrouped` (>1 section), which is about the scroll
// model: grouping that yields a single section still wants its label.
export function hasNamedGroups(order: readonly GroupId[]) {
  return order.some(g => g.label !== '')
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

// Regroup the fetched `rpcDataMap` (region idx → grouped result) into one raw
// region map per group key (group key → region idx → that group's raw data). The
// arc compute (`computeArcsFromPileupData`) consumes one of these per-group maps,
// so this is what lets arcs run per group.
//
// `hidden` is dropped HERE, not by each consumer, and that is the point. The
// per-lane consumers look a key up by an already-filtered `groupOrder`, so they
// never noticed; the cross-group ones (`derivativePathCandidates`, and the arc
// scale pooling) walk every entry, and each had to remember the rule on its own
// — `derivativePathCandidates` didn't, and ranked derivative-allele paths on
// chains from a lane the display never draws. Filtering the source makes every
// present and future walk of this map correct by construction, the same way
// `orderedGroups` → `groupOrder` does for the stacking order. `rpcDataMap` stays
// the unfiltered escape hatch for anything that genuinely wants every lane.
//
// Key order here is first-seen-across-regions, which is NOT the stacking order:
// a group absent from an early region lands later than it should, the very case
// `orderedGroups` re-sorts to fix. Every consumer looks a key up (`.get(key)`,
// driven by `groupOrder`), so nothing depends on this map's iteration order —
// don't start depending on it.
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

// read id → where that read lives (which region, which group, row index),
// letting hit-test/detail lookups resolve a feature back to its raw arrays.
//
// Hidden lanes are dropped here for the reason `buildRawDataByGroup` gives, plus
// one of its own: `findFeatureInRpcData` resolves an entry through
// `laidOutByGroup`, which is built from the already-filtered `groupOrder`, so a
// hidden lane's read matched a key that then resolved to nothing. Its entries
// were unreachable by construction — and each one cost a `readIdAt` string for a
// read no lookup can reach.
export function buildReadIdIndexMap(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
  hidden?: ReadonlySet<string>,
): Map<
  string,
  { displayedRegionIndex: number; groupKey: string; idx: number }
> {
  const map = new Map<
    string,
    { displayedRegionIndex: number; groupKey: string; idx: number }
  >()
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
