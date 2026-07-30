import { hasCrossingSpans } from '../features/sashimi/computeOverlay.ts'
import { compareGroupKeys } from '../shared/groupFeatures.ts'
import { getOrCreate } from '../shared/util.ts'

import type {
  GroupedAlignmentsResult,
  PileupDataResult,
} from '../RenderAlignmentDataRPC/types.ts'
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

// Just the per-region data, for scans that don't care about region/group
// identity (coverage/insert-size maxima, color legend categories).
export function* eachGroupData(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
  hidden?: ReadonlySet<string>,
) {
  for (const { data } of eachGroup(rpcDataMap, hidden)) {
    yield data
  }
}

// Short-circuiting `.some` over every group's data — stops at the first match
// without materializing the generator into an array (`[...eachGroupData()]`).
export function someGroupData(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
  predicate: (data: PileupDataResult) => boolean,
  hidden?: ReadonlySet<string>,
) {
  for (const data of eachGroupData(rpcDataMap, hidden)) {
    if (predicate(data)) {
      return true
    }
  }
  return false
}

// True when any loaded region/group has a sashimi junction passing
// `minSashimiScore`. The 'down' arm of `anyGroupHasSashimiDownArcs` below;
// exported for its own unit tests.
export function anyGroupHasSashimi(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
  minSashimiScore: number,
  hidden?: ReadonlySet<string>,
) {
  return someGroupData(
    rpcDataMap,
    d => d.sashimiCounts.some(c => c >= minSashimiScore),
    hidden,
  )
}

// True when some junction will actually be drawn in the strip below coverage —
// i.e. whether that strip is worth reserving. 'up' never uses it; 'down' uses it
// for any surviving junction; 'auto' only splits an arc down when junctions
// cross (see `hasCrossingSpans`), so a score filter that leaves no crossing pair
// frees the strip entirely and the survivors reclaim it.
//
// Deliberately genomic-bp, over every *loaded* region, so the layout keeps
// depending only on `rpcDataMap` — projecting to screen px would make the pileup
// re-lay-out on every pan frame. Interleaving survives any monotonic projection,
// so within a region this matches the screen-space assignment `computeSashimiArcs`
// runs; it only ever over-reserves (loaded ⊇ visible).
export function anyGroupHasSashimiDownArcs(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
  minSashimiScore: number,
  mode: SashimiArcsMode,
  hidden?: ReadonlySet<string>,
) {
  return mode === 'up'
    ? false
    : mode === 'down'
      ? anyGroupHasSashimi(rpcDataMap, minSashimiScore, hidden)
      : anyGroupHasCrossingSashimi(rpcDataMap, minSashimiScore, hidden)
}

// 'auto' pools a group's junctions across its regions before assigning sides, so
// the crossing scan pools the same way — a pair interleaving across two
// collapsed-intron regions of one group still reserves the strip.
function anyGroupHasCrossingSashimi(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
  minSashimiScore: number,
  hidden?: ReadonlySet<string>,
) {
  const spansByGroup = new Map<string, { left: number; right: number }[]>()
  for (const { key, data } of eachGroup(rpcDataMap, hidden)) {
    const spans = getOrCreate(spansByGroup, key, () => [])
    for (const [i, count] of data.sashimiCounts.entries()) {
      if (count >= minSashimiScore) {
        const start = data.sashimiX1[i]!
        const end = data.sashimiX2[i]!
        spans.push({ left: Math.min(start, end), right: Math.max(start, end) })
      }
    }
  }
  return [...spansByGroup.values()].some(hasCrossingSpans)
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
export function buildChainIdMap(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
  chainMode: boolean,
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  if (chainMode) {
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
// region map per group key (group key → region idx → that group's raw data). The
// arc compute (`computeArcsFromPileupData`) consumes one of these per-group maps,
// so this is what lets arcs run per group.
//
// Key order here is first-seen-across-regions, which is NOT the stacking order:
// a group absent from an early region lands later than it should, the very case
// `orderedGroups` re-sorts to fix. Every consumer looks a key up (`.get(key)`,
// driven by `groupOrder`), so nothing depends on this map's iteration order —
// don't start depending on it.
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
