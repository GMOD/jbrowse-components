import {
  attachLinkedReadLines,
  buildLaidOutChainMap,
} from './computeChainLayout.ts'
import { overlayReadTagColors } from './readTagColors.ts'
import { buildLaidOutPileupMap } from '../RenderAlignmentDataRPC/sortLayout.ts'

import type { GroupId } from './groupedDataMaps.ts'
import type { RegionBounds } from '../RenderAlignmentDataRPC/sortLayout.ts'
import type { PileupDataResult } from '../RenderAlignmentDataRPC/types.ts'
import type { ColorBy, SortedBy } from '../shared/types.ts'

// Per group key: region index → laid-out data (Y arrays filled).
export type LaidOutByGroup = Map<string, Map<number, PileupDataResult>>

// Max pileup rows a layout may produce before overflow reads collapse to the
// bottom. Hard-capped below the Uint16 ceiling so row indices (stored in
// `readYs`) and the overflow sentinel never wrap.
export function maxRowsFor(maxHeight: number, rowHeight: number) {
  return Math.max(
    1,
    Math.min(65534, Math.floor(maxHeight / Math.max(1, rowHeight))),
  )
}

// Everything needed to lay one group's reads out, minus the per-group row cap.
// The stacking `order` and this bundle stay constant across the fit passes; only
// the caps vary, so they're threaded separately.
export interface GroupLayoutContext {
  order: GroupId[]
  // Pre-grouped raw data (group key → region idx → data) from
  // `buildRawDataByGroup`; reused so the per-key region map is an O(1) lookup
  // instead of re-partitioning `rpcDataMap` with a nested `.find`.
  rawByGroup: ReadonlyMap<string, Map<number, PileupDataResult>>
  isChainMode: boolean
  sortedBy: SortedBy | undefined
  showSoftClipping: boolean
  // Region bounds by displayed-region index, so multi-region layout can locate
  // the sort position's region and detect the single-refName case.
  regions: ReadonlyMap<number, RegionBounds>
  showLinkedReadLines: boolean
  colorBy: ColorBy | undefined
  colorTagMap: Record<string, string>
}

// Lay out each group independently so one dense group can't starve the rest:
// every group runs the existing single/multi-region layout over just its own
// reads, capped at `maxRowsOverrides.get(key) ?? maxRows`. Ungrouped fetches are
// the one-group case, so this reduces exactly to the previous `laidOutPileupMap`.
// Stacking order is `ctx.order` (see `orderedGroups`), so this stays purely a
// layout pass — it doesn't re-derive group identity.
export function buildLaidOutByGroup(
  ctx: GroupLayoutContext,
  maxRows: number,
  maxRowsOverrides?: ReadonlyMap<string, number>,
): LaidOutByGroup {
  const byGroup: LaidOutByGroup = new Map()
  for (const { key } of ctx.order) {
    const dataMap =
      ctx.rawByGroup.get(key) ?? new Map<number, PileupDataResult>()
    const cap = maxRowsOverrides?.get(key) ?? maxRows
    const base = ctx.isChainMode
      ? buildLaidOutChainMap(dataMap, cap)
      : buildLaidOutPileupMap({
          dataMap,
          sortedBy: ctx.sortedBy,
          showSoftClipping: ctx.showSoftClipping,
          regions: ctx.regions,
          maxRows: cap,
        })
    const withLines = ctx.showLinkedReadLines
      ? attachLinkedReadLines(base)
      : base
    byGroup.set(
      key,
      overlayReadTagColors(withLines, ctx.colorBy, ctx.colorTagMap),
    )
  }
  return byGroup
}

// Fit-to-viewport policy inputs, in px, plus the per-group user overrides. Kept
// apart from `GroupLayoutContext` because these drive the row caps rather than
// the layout mechanics.
export interface FitViewportInput {
  rowHeight: number
  height: number
  maxHeight: number
  overhead: number
  // Groups drawing coverage only — they cost overhead but no pileup rows.
  collapsedKeys: ReadonlySet<string>
  // Per-group pileup-height overrides in px (drag / "show all"); opt out of the
  // shared fit budget entirely.
  heightOverridesPx: ReadonlyMap<string, number>
}

// The full grouped layout: split the viewport across the groups, lay them out,
// then reclaim any sparse group's unused rows for its truncated siblings. The
// single place the two-pass fit policy lives, so the model getter is a thin
// adapter and the whole pipeline is unit-testable without an MST instance.
export function layoutGroupsToViewport(
  ctx: GroupLayoutContext,
  fit: FitViewportInput,
): LaidOutByGroup {
  const { rowHeight, collapsedKeys, heightOverridesPx } = fit
  const maxHeightRows = maxRowsFor(fit.maxHeight, rowHeight)
  const grouped = ctx.order.length > 1
  // Collapsed groups draw only their coverage band, so they still cost overhead
  // but claim no pileup rows — divide the pileup budget across just the groups
  // still showing a pileup so collapsing frees space for the rest.
  const visibleGroupCount = ctx.order.filter(
    g => !collapsedKeys.has(g.key),
  ).length
  const defaultMaxRows = grouped
    ? fitGroupMaxRows({
        height: fit.height,
        groupCount: ctx.order.length,
        visibleGroupCount,
        rowHeight,
        overhead: fit.overhead,
        maxRows: maxHeightRows,
      })
    : maxHeightRows

  const overrideCaps = new Map<string, number>()
  for (const [key, px] of heightOverridesPx) {
    overrideCaps.set(key, maxRowsFor(px, rowHeight))
  }
  const pass = buildLaidOutByGroup(ctx, defaultMaxRows, overrideCaps)
  if (!grouped) {
    return pass
  }
  // Only fit-budget groups take part in reclaim — collapsed groups draw no
  // pileup and overridden groups opt out.
  const outcomes = ctx.order
    .filter(g => !collapsedKeys.has(g.key) && !heightOverridesPx.has(g.key))
    .map(({ key }) => {
      const map = pass.get(key) ?? new Map<number, PileupDataResult>()
      return {
        key,
        usedRows: groupMaxY(map),
        truncated: anyRegionTruncated(map),
      }
    })
  const bonusCaps = reclaimFitRows({
    outcomes,
    defaultMaxRows,
    maxRows: maxHeightRows,
  })
  return bonusCaps
    ? buildLaidOutByGroup(
        ctx,
        defaultMaxRows,
        new Map([...overrideCaps, ...bonusCaps]),
      )
    : pass
}

// Equal-split row budget per group when grouping fits to the viewport: every
// group still reserves its band overhead (coverage/arcs/sashimi) even when
// collapsed, so subtract `groupCount * overhead`, then divide the remaining
// height across only the `visibleGroupCount` groups that actually draw a pileup.
// Collapsing a group thus hands its pileup slice back to the ones still shown,
// keeping the stack fit to the viewport without dead space. Floored to a few
// rows so a tiny viewport or many groups still shows pileup (the overflow then
// scrolls), and never exceeds the display-wide `maxRows` cap. A group with fewer
// reads than its slice simply lays out all of them — the cap only truncates
// deeper groups.
export const MIN_FIT_ROWS = 3
export function fitGroupMaxRows({
  height,
  groupCount,
  visibleGroupCount,
  rowHeight,
  overhead,
  maxRows,
}: {
  height: number
  groupCount: number
  // Non-collapsed groups sharing the pileup budget; falls back to 1 so an
  // all-collapsed stack (no pileup drawn anyway) never divides by zero.
  visibleGroupCount: number
  rowHeight: number
  overhead: number
  maxRows: number
}) {
  const pileupBudget = height - groupCount * overhead
  const slice = pileupBudget / Math.max(1, visibleGroupCount)
  const rows = Math.max(MIN_FIT_ROWS, Math.floor(slice / rowHeight))
  return Math.min(maxRows, rows)
}

// One group's outcome after the equal-split layout pass, for the spare-row
// reclaim below. `usedRows` is how many rows it actually laid out (== the cap
// when it truncated, fewer when all its reads fit).
export interface FitGroupOutcome {
  key: string
  usedRows: number
  truncated: boolean
}

// After the equal-split pass caps every group at `defaultMaxRows`, sparse groups
// fit all their reads in fewer rows and leave the rest of their slice empty,
// while denser groups get truncated. Reclaim each sparse group's unused rows and
// split them evenly across the truncated groups, so the viewport budget goes to
// the groups that can use it instead of sitting empty. Returns a raised cap per
// truncated group (only those change), or undefined when nothing can move — no
// truncated recipient, or no spare — so the caller skips the second layout pass.
//
// Deliberately a single round: a recipient whose reads all fit under its raised
// cap may end up with a little slack again, but re-reclaiming that would mean
// laying out repeatedly. The new caps never push the participants past their
// original combined budget (`bonus * recipients <= spare`), so the stack still
// fits the viewport. Collapsed and height-overridden groups are excluded by the
// caller — they don't share the fit budget.
export function reclaimFitRows({
  outcomes,
  defaultMaxRows,
  maxRows,
}: {
  outcomes: FitGroupOutcome[]
  defaultMaxRows: number
  maxRows: number
}): Map<string, number> | undefined {
  const truncated = outcomes.filter(o => o.truncated)
  const spare = outcomes.reduce(
    (sum, o) => sum + (o.truncated ? 0 : defaultMaxRows - o.usedRows),
    0,
  )
  const bonus = truncated.length > 0 ? Math.floor(spare / truncated.length) : 0
  if (bonus <= 0) {
    return undefined
  }
  const caps = new Map<string, number>()
  for (const o of truncated) {
    caps.set(o.key, Math.min(maxRows, defaultMaxRows + bonus))
  }
  return caps
}

// Max row count for a group's laid-out region map (sections stack by this).
export function groupMaxY(map: Map<number, PileupDataResult>) {
  let max = 0
  for (const data of map.values()) {
    if (data.maxY > max) {
      max = data.maxY
    }
  }
  return max
}

// True when the row cap clipped any region of a group's laid-out map, i.e.
// reads were collapsed to the overflow sentinel. Drives the per-group "show
// all" affordance and the ungrouped truncation banner.
export function anyRegionTruncated(map: Map<number, PileupDataResult>) {
  for (const data of map.values()) {
    if (data.truncated) {
      return true
    }
  }
  return false
}
