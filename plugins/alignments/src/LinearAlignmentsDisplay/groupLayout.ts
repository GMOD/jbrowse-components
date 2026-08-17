import {
  buildLaidOutPileupMap,
  pileupLayoutMaxY,
  withoutLayout,
} from '../RenderAlignmentDataRPC/sortLayout.ts'
import {
  buildCollapsedPileupMap,
  collapsedLayoutMaxY,
} from './collapsedLayout.ts'
import {
  attachLinkedReadLines,
  buildLaidOutChainMap,
  chainLayoutMaxY,
} from './computeChainLayout.ts'
import { overlayReadColorCategories } from './readColorCategories.ts'
import { overlayReadTagColors } from './readTagColors.ts'

import type { RegionBounds } from '../RenderAlignmentDataRPC/sortLayout.ts'
import type {
  LaidOutPileupData,
  PileupDataResult,
  PileupLayoutArrays,
  RowCap,
  WorkerPileupData,
} from '../RenderAlignmentDataRPC/types.ts'
import type { ColorBy, SortedBy } from '../shared/types.ts'
import type { ReadColorOpts } from './colorUtils.ts'
import type { GroupId } from './groupedDataMaps.ts'

// Per group key: region index → laid-out data (Y arrays filled), colors not yet
// baked. `applyReadColorsByGroup` turns one of these into a `ColoredByGroup`,
// which is what every consumer outside this file reads.
export type LaidOutByGroup = Map<string, Map<number, LaidOutPileupData>>

// The same shape with both color bakes applied — the fully-tiered value.
export type ColoredByGroup = Map<string, Map<number, PileupDataResult>>

/**
 * Every value `pick` yields across every laid-out region of every group.
 *
 * This is the "what is actually on screen" question, and the legend asks it of
 * four different fields — read color categories, tag values, modification types,
 * and whether anything overlaps. Each asked it with its own copy of the same
 * two-deep walk, and getting the nesting wrong is silent: a scan that stops a
 * level early collects nothing and the legend simply lists fewer swatches.
 *
 * **The walk is over groups × REGIONS, not reads** — the inner map is keyed by
 * region index and each value holds that region's per-read arrays. So the O(n)
 * the callers gate on `showLegend` for is the iteration of what `pick` returns,
 * not this; one closure call per region costs nothing next to it.
 *
 * A `pick` returning `undefined` contributes nothing, so a field the worker only
 * sometimes ships needs no guard at the call site.
 */
export function collectAcrossGroups<T>(
  byGroup: ColoredByGroup,
  pick: (data: PileupDataResult) => Iterable<T> | undefined,
): Set<T> {
  const present = new Set<T>()
  for (const map of byGroup.values()) {
    for (const data of map.values()) {
      const values = pick(data)
      if (values) {
        for (const value of values) {
          present.add(value)
        }
      }
    }
  }
  return present
}

/**
 * Whether any laid-out region satisfies `pred`. The same walk asked as a
 * question rather than a collection, and its own function because it stops at
 * the first yes — which `collectAcrossGroups` cannot do.
 */
export function someAcrossGroups(
  byGroup: ColoredByGroup,
  pred: (data: PileupDataResult) => boolean,
): boolean {
  for (const map of byGroup.values()) {
    for (const data of map.values()) {
      if (pred(data)) {
        return true
      }
    }
  }
  return false
}

// Max pileup rows a layout may produce before overflow reads collapse to the
// bottom. Hard-capped below the Uint16 ceiling so row indices (stored in
// `readYs`) and the overflow sentinel never wrap.
export function maxRowsFor(maxHeight: number, rowHeight: number) {
  return Math.max(
    1,
    Math.min(65534, Math.floor(maxHeight / Math.max(1, rowHeight))),
  )
}

// The display-wide `maxHeight` cap, and the cap a lane's own height override
// sets. Two names rather than one `{rows, source}` literal per call site, so the
// policy is stated where the cap is built and the layout only has to carry it.
export function ceilingCap(rows: number): RowCap {
  return { rows, source: 'ceiling' }
}
export function overrideCap(rows: number): RowCap {
  return { rows, source: 'override' }
}

/**
 * The tighter of a lane's viewport slice and the display-wide ceiling, carrying
 * which of the two it turned out to be.
 *
 * The one place those two numbers meet, and the reason a clipped lane can name
 * what clipped it. `groupClippedBy` used to answer that afterwards by comparing a
 * lane's ROW COUNT back against the ceiling — true whenever the two caps differ,
 * and it read as arithmetic rather than as the question it was asking.
 *
 * A tie is the ceiling, because the expand the `'budget'` answer offers banks an
 * override OF `maxHeight`: where the slice already equals the ceiling, expanding
 * hands back the identical cap and not one extra read appears.
 */
export function tighterCap(budgetRows: number, ceilingRows: number): RowCap {
  return budgetRows < ceilingRows
    ? { rows: budgetRows, source: 'budget' }
    : ceilingCap(ceilingRows)
}

// Everything needed to lay one group's reads out, minus the per-group row cap.
// The stacking `order` and this bundle stay constant across the fit passes; only
// the caps vary, so they're threaded separately.
export interface GroupLayoutContext {
  order: GroupId[]
  // Pre-grouped raw data (group key → region idx → data) from
  // `buildRawDataByGroup`; reused so the per-key region map is an O(1) lookup
  // instead of re-partitioning `rpcDataMap` with a nested `.find`.
  rawByGroup: ReadonlyMap<string, Map<number, WorkerPileupData>>
  isChainMode: boolean
  sortedBy: SortedBy | undefined
  showSoftClipping: boolean
  largeFeaturesFirst: boolean
  // Region bounds by displayed-region index, so multi-region layout can locate
  // the sort position's region and detect the single-refName case.
  regions: ReadonlyMap<number, RegionBounds>
  // Here despite `attachLinkedReadLines` never moving a read — it derives line
  // records from rows already placed — so toggling it does pay the relayout the
  // color/layout split exists to avoid. Deliberate: the lines embed `readYs`
  // values, so they are a function of the layout and have to be rebuilt on every
  // layout invalidation anyway. A separate memo downstream would buy exactly one
  // menu click and nothing in steady state, which is not the trap that split
  // guards against (an input that changes at drag/frame rate).
  showLinkedReadLines: boolean
  // Draw each group as a single row, overlap depth carried by the tint layer
  // instead of by stacking (`collapsedLayout.ts`). A group the user has sized
  // explicitly opts back out, which is what makes the label chip's expand
  // affordance a true-stack toggle.
  collapseGroupRows: boolean
}

// Lay out one group's reads (Y arrays filled + linked-read lines) at a given row
// cap. Extracted so the fit reclaim pass can re-lay-out just the groups whose
// cap changed instead of rebuilding every group.
//
// `coverageOnly` is the label chip's chevron: that lane draws its coverage band
// and no pileup at all, so there is no placement to do and every row is 0 —
// `sections` reads its maxY as 0 (`groupMaxYFor`) whatever this returns. The
// zero-row layout is what skips the dominant cost, `cloneWithLayout`'s per-feature
// `remapYs` gather and modification Flatbush (the same cost
// `layoutGroupRowCounts` exists to avoid); every other consumer of a group's map
// reads fields layout doesn't touch (`readPositions`, the color arrays) or asks
// for `maxY`.
function layoutOneGroup(
  ctx: GroupLayoutContext,
  key: string,
  cap: RowCap,
  collapse = false,
  coverageOnly = false,
): Map<number, LaidOutPileupData> {
  const dataMap = ctx.rawByGroup.get(key) ?? new Map<number, WorkerPileupData>()
  if (coverageOnly) {
    return new Map([...dataMap].map(([idx, d]) => [idx, withoutLayout(d)]))
  }
  if (collapse) {
    return buildCollapsedPileupMap(dataMap)
  }
  const base = ctx.isChainMode
    ? buildLaidOutChainMap({ dataMap, regions: ctx.regions, rowCap: cap })
    : buildLaidOutPileupMap({
        dataMap,
        sortedBy: ctx.sortedBy,
        showSoftClipping: ctx.showSoftClipping,
        regions: ctx.regions,
        rowCap: cap,
        largeFeaturesFirst: ctx.largeFeaturesFirst,
      })
  return ctx.showLinkedReadLines ? attachLinkedReadLines(base) : base
}

// Per-read color inputs. A separate bundle from `GroupLayoutContext` because
// they invalidate a different tier: none of them can move a read's row, so
// recoloring must not re-run the placement pass, the per-feature Y remap, or the
// modification Flatbush that `cloneWithLayout` builds. Kept out of `renderState`
// too, so the GPU, the Canvas2D fallback and the legend all read one
// classification.
export interface ReadColorContext {
  colorBy: ColorBy | undefined

  colorScheme: number
  readColorOpts: ReadColorOpts
}

/**
 * Bake the two per-read color arrays over an already laid-out map.
 *
 * Runs downstream of layout, and spreads each region's laid-out result rather
 * than rebuilding it, so every other array — `readYs` above all — stays
 * reference-identical. That identity is load-bearing twice over: it is what the
 * GPU renderer's upload memo reads to recognize a recolor and rewrite only the
 * read pass, and it is what keeps a color flip off the layout path entirely.
 *
 * Tag colors first: the `noTagValue` category is decided from the baked
 * `readTagColors`, so classifying before that buckets every tag-colored read
 * wrong. One place so the two passes can't be reordered by accident.
 */
export function applyReadColorsByGroup(
  byGroup: LaidOutByGroup,
  ctx: ReadColorContext,
): ColoredByGroup {
  const out: ColoredByGroup = new Map()
  for (const [key, map] of byGroup) {
    out.set(
      key,
      overlayReadColorCategories(
        overlayReadTagColors(map, ctx.colorBy),
        ctx.colorScheme,
        ctx.readColorOpts,
      ),
    )
  }
  return out
}

// Lay out each group independently so one dense group can't starve the rest:
// every group runs the existing single/multi-region layout over just its own
// reads, capped at `capOverrides.get(key) ?? cap`. Ungrouped fetches are
// the one-group case, so this reduces exactly to the previous `laidOutPileupMap`.
// Stacking order is `ctx.order` (see `orderedGroups`), so this stays purely a
// layout pass — it doesn't re-derive group identity.
export function buildLaidOutByGroup(
  ctx: GroupLayoutContext,
  cap: RowCap,
  capOverrides: ReadonlyMap<string, RowCap> = NO_OVERRIDES,
  coverageOnlyKeys: ReadonlySet<string> = NOTHING_COLLAPSED,
): LaidOutByGroup {
  const byGroup: LaidOutByGroup = new Map()
  for (const { key } of ctx.order) {
    byGroup.set(
      key,
      layoutOneGroup(
        ctx,
        key,
        capOverrides.get(key) ?? cap,
        collapsesRows(ctx, key, capOverrides),
        coverageOnlyKeys.has(key),
      ),
    )
  }
  return byGroup
}

const NOTHING_COLLAPSED: ReadonlySet<string> = new Set()

// Every caller passing no per-group sizes shares this, so `collapsesRows` can
// take a required map and never has to treat "no overrides" as a missing
// argument.
const NO_OVERRIDES: ReadonlyMap<string, RowCap> = new Map()

// Whether a group draws as one row. An explicitly-sized group (the label chip's
// expand, or a height drag) opts out, so that affordance reads as "expand this
// lane into a true stack". Chain mode opts out wholesale: its rows are chains,
// and collapsing them would drop the connecting lines that are the point of the
// mode.
function collapsesRows(
  ctx: GroupLayoutContext,
  key: string,
  capOverrides: ReadonlyMap<string, RowCap>,
) {
  return ctx.collapseGroupRows && !ctx.isChainMode && !capOverrides.has(key)
}

// Per-group row counts (maxY) only — no laid-out clones. The fit-height pass
// needs just each group's stack depth to size reads, so it skips the dominant
// `cloneWithLayout` cost (per-base *Ys arrays) that `buildLaidOutByGroup` pays.
// Row counts match `groupMaxY(buildLaidOutByGroup(...).get(key))` exactly:
// `attachLinkedReadLines`/`overlayReadTagColors` never change `maxY`.
// A plain row count in, because no entry comes out: `rowCap`'s source labels a
// clip on a laid-out region and there are none here. The caller's cap is the
// display ceiling.
export function layoutGroupRowCounts(
  ctx: GroupLayoutContext,
  maxRows: number,
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const { key } of ctx.order) {
    const dataMap =
      ctx.rawByGroup.get(key) ?? new Map<number, WorkerPileupData>()
    counts.set(
      key,
      // No per-group sizes here: this pass answers "how many rows would each
      // group take", which the caller (fit-height) asks before any override
      // exists.
      collapsesRows(ctx, key, NO_OVERRIDES)
        ? collapsedLayoutMaxY(dataMap)
        : ctx.isChainMode
          ? chainLayoutMaxY({ dataMap, regions: ctx.regions, maxRows })
          : pileupLayoutMaxY({
              dataMap,
              sortedBy: ctx.sortedBy,
              showSoftClipping: ctx.showSoftClipping,
              regions: ctx.regions,
              rowCap: ceilingCap(maxRows),
              largeFeaturesFirst: ctx.largeFeaturesFirst,
            }),
    )
  }
  return counts
}

// Fit-to-viewport policy inputs, in px, plus the per-group user overrides. Kept
// apart from `GroupLayoutContext` because these drive the row caps rather than
// the layout mechanics.
export interface FitViewportInput {
  rowHeight: number
  height: number
  maxHeight: number
  // Per-group band overhead (coverage + arc + sashimi strips) in px, as a thunk
  // rather than a value because only the grouped branch spends it. Read eagerly,
  // it puts every band height in the layout computed's dependency set, so an
  // ungrouped display re-placed every row — and its renderer repacked every GPU
  // buffer — on each frame of a coverage/arc band resize drag, to draw the rows
  // it already had. Grouping does divide the viewport by band overhead, so there
  // the dependency is real and the thunk is called.
  overhead: () => number
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
  // Ungrouped takes the ceiling and never a slice: there is nothing to split the
  // viewport with, which is why its clip is always the one the banner speaks for.
  const defaultCap = grouped
    ? fitGroupMaxRows({
        height: fit.height,
        groupCount: ctx.order.length,
        visibleGroupCount,
        rowHeight,
        overhead: fit.overhead(),
        maxRows: maxHeightRows,
      })
    : ceilingCap(maxHeightRows)

  const overrideCaps = new Map<string, RowCap>()
  for (const [key, px] of heightOverridesPx) {
    overrideCaps.set(key, overrideCap(maxRowsFor(px, rowHeight)))
  }
  const pass = buildLaidOutByGroup(ctx, defaultCap, overrideCaps, collapsedKeys)
  if (!grouped) {
    return pass
  }
  // Only fit-budget groups take part in reclaim — collapsed groups draw no
  // pileup, overridden groups opt out, and a single-row group's height is fixed
  // at one row whatever cap it is handed.
  const outcomes = ctx.order
    .filter(
      g =>
        !collapsedKeys.has(g.key) &&
        !heightOverridesPx.has(g.key) &&
        !collapsesRows(ctx, g.key, overrideCaps),
    )
    .map(({ key }) => {
      const map = pass.get(key) ?? new Map<number, LaidOutPileupData>()
      return {
        key,
        usedRows: groupMaxY(map),
        truncated: anyRegionTruncated(map),
      }
    })
  const bonusCaps = reclaimFitRows({
    outcomes,
    defaultMaxRows: defaultCap.rows,
    maxRows: maxHeightRows,
  })
  // Only the truncated groups get a raised cap; every other group's layout is
  // byte-identical to pass 1, so reuse it and re-lay-out just the changed ones.
  let result = pass
  if (bonusCaps) {
    result = new Map(pass)
    for (const [key, cap] of bonusCaps) {
      result.set(key, layoutOneGroup(ctx, key, cap))
    }
  }
  return result
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
  return tighterCap(rows, maxRows)
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
}): Map<string, RowCap> | undefined {
  const truncated = outcomes.filter(o => o.truncated)
  const spare = outcomes.reduce(
    (sum, o) => sum + (o.truncated ? 0 : defaultMaxRows - o.usedRows),
    0,
  )
  const bonus = truncated.length > 0 ? Math.floor(spare / truncated.length) : 0
  if (bonus <= 0) {
    return undefined
  }
  const caps = new Map<string, RowCap>()
  for (const o of truncated) {
    // A raised slice is still a slice — unless the raise reaches the ceiling,
    // where the lane has run out of anything an expand could give it.
    caps.set(o.key, tighterCap(defaultMaxRows + bonus, maxRows))
  }
  return caps
}

// Max row count for a group's laid-out region map (sections stack by this).
export function groupMaxY(map: ReadonlyMap<number, PileupLayoutArrays>) {
  let max = 0
  for (const data of map.values()) {
    if (data.maxY > max) {
      max = data.maxY
    }
  }
  return max
}

/**
 * Which cap hid reads from a group's laid-out map, or `undefined` when nothing
 * was hidden.
 *
 * A field read: the layout pass recorded what bound it. The lane is one layout
 * over several regions, so any clipped region answers for the lane — a region
 * whose own reads all fit still shares the cap.
 */
export function groupClipSource(map: ReadonlyMap<number, PileupLayoutArrays>) {
  for (const data of map.values()) {
    if (data.clippedBy) {
      return data.clippedBy
    }
  }
  return undefined
}

// Whether any of a group's rows were hidden, whichever cap did it. Drives the
// fit-budget reclaim and the height drag's "is there anything to grow into".
export function anyRegionTruncated(
  map: ReadonlyMap<number, PileupLayoutArrays>,
) {
  return groupClipSource(map) !== undefined
}

// The per-group pileup-height override (px) after one drag frame, or `undefined`
// to leave the group on the shared fit budget (bank no override). The override
// caps how many rows the group lays out (`maxRowsFor`); a drag accumulates it
// continuously, `dy` being the per-frame pointer delta (positive = taller).
//
// Pure so the drag policy is unit-tested here rather than inferred from the MST
// action. Three rules, each isolated below:
//   - Accumulate from the stored px, not the row-snapped displayed height —
//     re-seeding from `displayed` every frame stutters, since a sub-row `dy`
//     rounds away against the snap. Seed from `displayed` only on the first
//     frame (no existing override). When an override already runs past the
//     content, clamp its base to one row of headroom so a reversing drag
//     responds immediately instead of eating the dead pixels first.
//   - Floor at one row.
//   - A fully-shown group (nothing hidden) can't grow past its content height:
//     an upward drag pins at `displayed`, and a *fresh* upward drag banks
//     nothing at all (an override equal to `displayed` is a dead "fit to view"
//     affordance).
export function nextGroupHeightOverride({
  dy,
  rowHeight,
  displayedPx,
  existingPx,
  fullyShown,
}: {
  dy: number
  rowHeight: number
  // Height the group's pileup currently occupies, row-snapped (maxY*rowHeight).
  displayedPx: number
  // Current override px, or undefined when the group is still on the fit budget.
  existingPx: number | undefined
  // Whether every read already shows (no hidden rows to grow into).
  fullyShown: boolean
}): number | undefined {
  const growingFullyShown = dy > 0 && fullyShown
  const base =
    existingPx === undefined
      ? displayedPx
      : Math.min(existingPx, displayedPx + rowHeight)
  const grown = Math.max(rowHeight, base + dy)
  const capped = growingFullyShown ? Math.min(grown, displayedPx) : grown
  // A fresh grow-drag on a fully-shown group would only pin at its content, so
  // leave it unset rather than bank a dead override.
  return existingPx === undefined && growingFullyShown ? undefined : capped
}
