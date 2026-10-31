import {
  buildLaidOutPileupMap,
  pileupLayoutMaxY,
  withoutLayout,
} from '../RenderAlignmentDataRPC/sortLayout.ts'
import { consensusChainStrandFrames } from './chainStrandConsensus.ts'
import {
  buildCollapsedPileupMap,
  collapsedLayoutMaxY,
} from './collapsedLayout.ts'
import { buildLaidOutChainMap, chainLayoutMaxY } from './computeChainLayout.ts'
import { NORMAL_PITCH } from './menus/compactnessPresets.ts'
import { overlayReadColorCategories } from './readColorCategories.ts'
import { overlayReadFillColors } from './readFillColors.ts'

import type { RegionBounds } from '../RenderAlignmentDataRPC/sortLayout.ts'
import type {
  ChainedPileupData,
  LaidOutPileupData,
  PileupDataResult,
  PileupLayoutArrays,
  RowCap,
} from '../RenderAlignmentDataRPC/types.ts'
import type { GroupConnectors } from '../features/linkedReads/computeOverlay.ts'
import type {
  ColorFieldKind,
  LayoutOrder,
  SortColumn,
} from '../shared/types.ts'
import type { BakedColorScale } from './bakedColorScale.ts'
import type { ReadColorOpts } from './colorUtils.ts'
import type { AlignmentsUnit } from './constants.ts'
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

// The `pileup.maxLayoutHeight` cap, and the cap a lane's own height override
// sets. Two names rather than one `{rows, source}` literal per call site, so the
// policy is stated where the cap is built and the layout only has to carry it.
export function ceilingCap(rows: number): RowCap {
  return { rows, source: 'ceiling' }
}
function overrideCap(rows: number): RowCap {
  return { rows, source: 'override' }
}

/**
 * The tighter of a lane's viewport slice and the display-wide ceiling, carrying
 * which of the two it turned out to be.
 *
 * The one place those two numbers meet, and the reason a clipped lane can name
 * what clipped it, rather than reconstructing the answer afterwards by comparing
 * a lane's ROW COUNT back against the ceiling — true whenever the two caps
 * differ.
 *
 * A tie is the ceiling, because the expand the `'budget'` answer offers banks an
 * override OF `pileup.maxLayoutHeight`: where the slice already equals the ceiling, expanding
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
  // Group key → region idx → fetched data, with chain identity attached in
  // chain mode (the model's `chainedByGroup`).
  rawByGroup: ReadonlyMap<string, ReadonlyMap<number, ChainedPileupData>>
  unit: AlignmentsUnit
  sortColumn: SortColumn | undefined
  showSoftClips: boolean
  layoutOrder: LayoutOrder
  // Region bounds by displayed-region index, so multi-region layout can locate
  // the sort position's region and detect the single-refName case.
  regions: ReadonlyMap<number, RegionBounds>
  // Draw each group as a single row, overlap depth carried by the tint layer
  // instead of by stacking (`collapsedLayout.ts`). A group the user has sized
  // explicitly opts back out, which is what makes the label chip's expand
  // affordance a true-stack toggle.
  collapseSections: boolean
}

// One group's regions. `ctx.order` and `rawByGroup` are two views of one
// `rpcDataMap`, so a key present in the first is present in the second — the
// empty map keeps both passes below total for a miss they cannot see, spelled
// here rather than once each.
const NO_REGIONS: ReadonlyMap<number, ChainedPileupData> = new Map()
function regionsOf(ctx: GroupLayoutContext, key: string) {
  return ctx.rawByGroup.get(key) ?? NO_REGIONS
}

// Lay out one group's reads (Y arrays filled + linked-read lines) at a given row
// cap. Extracted so the fit reclaim pass can re-lay-out just the groups whose
// cap changed instead of rebuilding every group.
//
// A `coverageOnly` lane (the label chip's chevron) draws its coverage band and
// no pileup, so every row is 0. The zero-row layout is what skips the dominant
// cost, `cloneWithLayout`'s per-feature `remapYs` gather and modification
// Flatbush; every other consumer of a group's map reads fields layout doesn't
// touch (`readPositions`, the color arrays) or asks for `maxY`.
function layoutOneGroup(
  ctx: GroupLayoutContext,
  key: string,
  cap: RowCap,
  layout: LaneLayout,
): Map<number, LaidOutPileupData> {
  const dataMap = regionsOf(ctx, key)
  return layout === 'coverageOnly'
    ? new Map([...dataMap].map(([idx, d]) => [idx, withoutLayout(d)]))
    : layout === 'oneRow'
      ? buildCollapsedPileupMap(dataMap)
      : ctx.unit === 'chain'
        ? buildLaidOutChainMap({ dataMap, regions: ctx.regions, rowCap: cap })
        : buildLaidOutPileupMap({
            dataMap,
            sortColumn: ctx.sortColumn,
            showSoftClips: ctx.showSoftClips,
            regions: ctx.regions,
            rowCap: cap,
            layoutOrder: ctx.layoutOrder,
          })
}

// Per-read color inputs. A separate bundle from `GroupLayoutContext` because
// they invalidate a different tier: none of them can move a read's row, so
// recoloring must not re-run the placement pass, the per-feature Y remap, or the
// modification Flatbush that `cloneWithLayout` builds. Kept out of `renderState`
// too, so the GPU, the Canvas2D fallback and the legend all read one
// classification.
export interface ReadColorContext {
  // The `encoding.color` field the bake reads, undefined for the plain fill.
  colorField: string | undefined
  // What the body paints as: `colorField`'s kind, or the modification
  // layer's own tint under the plain fill (`bodyColorKind`).
  bodyColorKind: ColorFieldKind
  readColorOpts: ReadColorOpts
  // Required-but-nullable, so dropping it from the model's context is a compile
  // error instead of a silent fall back onto the plain fill.
  bakedScale: BakedColorScale | undefined
}

/**
 * Settle every unpaired split chain's `readChainHasSupp` frame bit by comparing
 * chains to each other (`consensusChainStrandFrames`), over an already laid-out
 * map and ahead of the color bake. `attachChainFields` has already made the
 * frame one answer per chain; this settles which way "same strand" points.
 *
 * ITS OWN STEP because its inputs are its own: it reads the layout, chain mode
 * and whether the framing is live, and nothing in `ReadColorContext`. Folded
 * into the color bake it re-ran on every field switch and every tag value
 * discovered mid-fetch, re-solving a relaxation over every chain on screen for a
 * bit-identical answer. Callers should memoize this on `framed` as a BOOLEAN, so
 * the fields that share an answer share the memo.
 *
 * Across every group, since the consensus is a comparison BETWEEN chains, and
 * confining it to a group let two sections of the same locus settle on opposite
 * signs — the red-for-blue swap its global sign anchor exists to prevent,
 * happening between sections instead of between renders.
 */
export function applyChainStrandFrames(
  byGroup: LaidOutByGroup,
  unit: AlignmentsUnit,
  framed: boolean,
): LaidOutByGroup {
  if (unit !== 'chain' || !framed) {
    return byGroup
  }
  // The groups are flattened into a private key space and split back out again.
  // The keys are this function's alone — nothing downstream sees them — so a
  // running counter is enough to name them, but it is NOT what says which of
  // them share a locus: the consensus buckets by overlap within one locus, and
  // two lanes of one region are one locus. `locusOf` hands it back the region
  // index, without which two lanes at the same breakpoint share no bucket,
  // contribute nothing to each other's objective, and settle on opposite signs
  // — the very thing this pass runs across all the groups to prevent.
  const flat = new Map<number, LaidOutPileupData>()
  const origin: { key: string; idx: number }[] = []
  for (const [key, map] of byGroup) {
    for (const [idx, data] of map) {
      flat.set(origin.length, data)
      origin.push({ key, idx })
    }
  }
  const framedFlat = consensusChainStrandFrames(
    flat,
    flatKey => origin[flatKey]!.idx,
  )
  if (framedFlat === flat) {
    return byGroup
  }
  const out: LaidOutByGroup = new Map()
  for (const key of byGroup.keys()) {
    out.set(key, new Map())
  }
  for (const [flatKey, data] of framedFlat) {
    const { key, idx } = origin[flatKey]!
    out.get(key)!.set(idx, data)
  }
  return out
}

// The straight-line pass's records spread onto the regions holding a line.
// After the color bake, so a recolor leaves the line arrays the GPU holds
// alone and a curved-connector toggle leaves the colors.
export function attachLinkedReadLinesByGroup(
  byGroup: ColoredByGroup,
  connectors: ReadonlyMap<string, GroupConnectors>,
): ColoredByGroup {
  if (connectors.size === 0) {
    return byGroup
  }
  const out: ColoredByGroup = new Map()
  for (const [key, map] of byGroup) {
    const lines = connectors.get(key)?.lines
    out.set(
      key,
      lines?.size
        ? new Map(
            [...map].map(([idx, data]) => {
              const own = lines.get(idx)
              return [idx, own ? { ...data, ...own } : data]
            }),
          )
        : map,
    )
  }
  return out
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
 * `readFillColors`, so classifying before that buckets every tag-colored read
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
        overlayReadFillColors(map, ctx.colorField, ctx.bakedScale),
        ctx.bodyColorKind,
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
  coverageOnlyKeys: ReadonlySet<string> = NO_KEYS,
): LaidOutByGroup {
  const byGroup: LaidOutByGroup = new Map()
  for (const { key } of ctx.order) {
    byGroup.set(
      key,
      layoutOneGroup(
        ctx,
        key,
        capOverrides.get(key) ?? cap,
        laneLayoutOf(ctx, key, capOverrides, coverageOnlyKeys),
      ),
    )
  }
  return byGroup
}

const NO_KEYS: ReadonlySet<string> = new Set()
const NO_OVERRIDES: ReadonlyMap<string, RowCap> = new Map()

/**
 * How one lane lays its reads out: stacked in rows, all on one row (the
 * `collapseSections` setting), or not at all (the chip's coverage-only
 * chevron).
 */
export type LaneLayout = 'stacked' | 'oneRow' | 'coverageOnly'

// An explicitly-sized lane (the chip's expand, or a height drag) opts out of
// one row, so that affordance reads as "expand this lane into a true stack".
// Chain mode opts out wholesale: its rows are chains, and one row would drop
// the connecting lines that are the point of the mode.
export function laneLayoutOf(
  ctx: GroupLayoutContext,
  key: string,
  capOverrides: ReadonlyMap<string, RowCap>,
  coverageOnlyKeys: ReadonlySet<string>,
): LaneLayout {
  return coverageOnlyKeys.has(key)
    ? 'coverageOnly'
    : ctx.collapseSections && ctx.unit !== 'chain' && !capOverrides.has(key)
      ? 'oneRow'
      : 'stacked'
}

// One lane's row count (maxY) only — no laid-out clone. The fit pass needs
// just each lane's stack depth to size reads, so it skips the dominant
// `cloneWithLayout` cost (per-base *Ys arrays) that `buildLaidOutByGroup` pays.
// It matches `groupMaxY(buildLaidOutByGroup(...).get(key))` exactly. No
// per-lane sizes here: the caller (fit) asks before any override is in effect.
function laneRowCount(ctx: GroupLayoutContext, key: string, maxRows: number) {
  const dataMap = regionsOf(ctx, key)
  return laneLayoutOf(ctx, key, NO_OVERRIDES, NO_KEYS) === 'oneRow'
    ? collapsedLayoutMaxY(dataMap)
    : ctx.unit === 'chain'
      ? chainLayoutMaxY({ dataMap, regions: ctx.regions, maxRows })
      : pileupLayoutMaxY({
          dataMap,
          sortColumn: ctx.sortColumn,
          showSoftClips: ctx.showSoftClips,
          regions: ctx.regions,
          rowCap: ceilingCap(maxRows),
          layoutOrder: ctx.layoutOrder,
        })
}

// How many rows each lane needs, in stacking order, laid out uncapped; 0 for a
// coverage-only lane. `pileup.maxLayoutHeight` bounds the counting pass only —
// NOT the current read height, so the fit autorun that writes `featureHeight`
// can't feed back into the count it is derived from.
export function fitLaneRows(
  ctx: GroupLayoutContext,
  maxHeight: number,
  coverageOnlyKeys: ReadonlySet<string>,
) {
  const maxRows = maxRowsFor(maxHeight, 1)
  return ctx.order.map(({ key }) =>
    coverageOnlyKeys.has(key) ? 0 : laneRowCount(ctx, key, maxRows),
  )
}

// One lane as the fit sees it: the rows it stacks and the band stack above
// them (`laneBandOverheads`).
export interface FitLane {
  rows: number
  overhead: number
}

export interface FittedReadPitchInput {
  lanes: readonly FitLane[]
  // The fit slot, never the reactive `height` getter: the same anti-cycle rule
  // `layoutGroupsToViewport`'s caller follows.
  fitTargetHeight: number
  // The least a lane's section may take, so its label chip has room
  // (`GROUP_LABEL_HEIGHT` while chips draw). A lane shorter than this at the
  // solved pitch is padded to it, so it costs this and its rows nothing.
  minLaneHeight: number
}

/**
 * The row pitch that makes every lane's reads fill the display without
 * scrolling: the space left after every lane's band stack, divided by the row
 * count.
 *
 * A lane padded to `minLaneHeight` takes that height whatever the pitch, so it
 * leaves the solve: its rows stop sharing the space and its pad is charged
 * instead. Padding a lane only lowers the pitch, so a lane once padded stays
 * padded and the loop settles within one pass per lane.
 *
 * Fractional (not floored): the pileup then fills the display exactly. Clamped
 * up to a 1px floor — below 1px the reads can't all fit, so the stack scrolls
 * instead. 0 when there's nothing to fit (no data / no room), signalling
 * "leave the configured height as-is".
 *
 * Also clamped down to the NORMAL read pitch — not the configured height —
 * because fit OVERRIDES the compactness preset: a handful of reads in a tall
 * display would otherwise stretch to fill it, and capping at the configured
 * height would let a Compact selection clamp the fit expansion instead.
 */
export function fittedReadPitch({
  lanes,
  fitTargetHeight,
  minLaneHeight,
}: FittedReadPitchInput) {
  const padded = new Set<FitLane>()
  let pitch = 0
  let settled = false
  while (!settled) {
    let fixed = 0
    let rows = 0
    for (const lane of lanes) {
      if (padded.has(lane)) {
        fixed += minLaneHeight
      } else {
        fixed += lane.overhead
        rows += lane.rows
      }
    }
    const space = fitTargetHeight - fixed
    pitch =
      rows > 0 && space > 0
        ? Math.min(NORMAL_PITCH, Math.max(1, space / rows))
        : 0
    const short = lanes.filter(
      lane =>
        !padded.has(lane) && lane.overhead + lane.rows * pitch < minLaneHeight,
    )
    for (const lane of short) {
      padded.add(lane)
    }
    settled = short.length === 0
  }
  return pitch
}

// Fit-to-viewport policy inputs, in px, plus the per-group user overrides. Kept
// apart from `GroupLayoutContext` because these drive the row caps rather than
// the layout mechanics.
export interface FitViewportInput {
  // The display-wide ceiling in rows, resolved by the caller for the reason
  // `defaultCap` gives: under a fit drag the pitch it divides moves a fraction
  // of a px per frame (`fitCeilingRows`).
  maxRows: number
  // The cap a lane on the shared fit budget lays out under, already resolved:
  // the viewport slice when the lanes split it (`fitGroupMaxRows`), the
  // display-wide ceiling when not.
  //
  // Resolved by the CALLER, and that is the whole point. It is derived from the
  // track height and the summed band overhead, both of which move a px at a time
  // under a resize drag while the cap they produce moves a ROW at a time — so
  // taking them as numbers here put them in the layout computed's dependency
  // set, and every frame of a track-height or band drag re-placed every row and
  // re-baked every color to arrive at the identical arrays. An ungrouped display
  // spends neither and was invalidated by both. `resolveFitDefaultCap` builds it
  // and the model's `fitDefaultCap` is where that gate lives.
  defaultCap: RowCap
  // Groups drawing coverage only — they cost overhead but no pileup rows.
  collapsedKeys: ReadonlySet<string>
  // The row caps the per-group height overrides impose (drag / "show all"); a
  // lane with one opts out of the shared fit budget entirely. Caps rather than
  // the px they came from, because px that round to the same row count lay out
  // identically — `groupRowCapSignature` is what lets the model notice.
  overrideCaps: ReadonlyMap<string, RowCap>
}

// The full grouped layout: split the viewport across the groups, lay them out,
// then reclaim any sparse group's unused rows for its truncated siblings. The
// single place the two-pass fit policy lives, so the model getter is a thin
// adapter and the whole pipeline is unit-testable without an MST instance.
export function layoutGroupsToViewport(
  ctx: GroupLayoutContext,
  fit: FitViewportInput,
): LaidOutByGroup {
  const { maxRows, collapsedKeys, overrideCaps, defaultCap } = fit
  // A lane under the ceiling has no slice another could give back to.
  const sharesBudget = ctx.order.length > 1 && defaultCap.source === 'budget'
  const pass = buildLaidOutByGroup(ctx, defaultCap, overrideCaps, collapsedKeys)
  if (!sharesBudget) {
    return pass
  }
  // Only fit-budget groups take part in reclaim — collapsed groups draw no
  // pileup, overridden groups opt out, and a single-row group's height is fixed
  // at one row whatever cap it is handed.
  //
  // Walking `pass` rather than `ctx.order` and looking each key back up: it was
  // just built one entry per `ctx.order` key, in that order, so the map already
  // pairs each key with the layout this reads.
  const outcomes: FitGroupOutcome[] = []
  for (const [key, map] of pass) {
    if (
      overrideCaps.has(key) ||
      laneLayoutOf(ctx, key, overrideCaps, collapsedKeys) !== 'stacked'
    ) {
      continue
    }
    outcomes.push({
      key,
      usedRows: groupMaxY(map),
      truncated: anyRegionTruncated(map),
    })
  }
  const bonusCaps = reclaimFitRows({
    outcomes,
    defaultMaxRows: defaultCap.rows,
    maxRows,
  })
  // Only the truncated groups get a raised cap; every other group's layout is
  // byte-identical to pass 1, so reuse it and re-lay-out just the changed ones.
  let result = pass
  if (bonusCaps) {
    result = new Map(pass)
    for (const [key, cap] of bonusCaps) {
      result.set(key, layoutOneGroup(ctx, key, cap, 'stacked'))
    }
  }
  return result
}

// Equal-split row budget per group when grouping fits to the viewport: subtract
// what the bands cost over the whole stack, then divide the remaining height
// across only the `visibleGroupCount` groups that actually draw a pileup.
// Collapsing a group thus hands its pileup slice back to the ones still shown,
// keeping the stack fit to the viewport without dead space. Floored to a few
// rows so a tiny viewport or many groups still shows pileup (the overflow then
// scrolls), and never exceeds the display-wide `maxRows` cap. A group with fewer
// reads than its slice simply lays out all of them — the cap only truncates
// deeper groups.
//
// `totalOverhead` is already summed over every group, collapsed ones included
// (they still show coverage). It arrives summed rather than as one group's cost
// times the count because the two strips below coverage are reserved per lane —
// see `laneBandOverheads`.
export const MIN_FIT_ROWS = 3
export function fitGroupMaxRows({
  height,
  visibleGroupCount,
  rowHeight,
  totalOverhead,
  maxRows,
}: {
  height: number
  // Non-collapsed groups sharing the pileup budget; falls back to 1 so an
  // all-collapsed stack (no pileup drawn anyway) never divides by zero.
  visibleGroupCount: number
  rowHeight: number
  totalOverhead: number
  maxRows: number
}) {
  const pileupBudget = height - totalOverhead
  const slice = pileupBudget / Math.max(1, visibleGroupCount)
  const rows = Math.max(MIN_FIT_ROWS, Math.floor(slice / rowHeight))
  return tighterCap(rows, maxRows)
}

// The cap every lane on the shared fit budget lays out under. When the lanes
// split the viewport, that is its slice of it; ungrouped there is nothing to
// split, and a fitted pitch already holds every lane whole, so it is the
// display-wide ceiling — which is why such a clip is always the one the
// truncation banner speaks for.
//
// Lifted out of `layoutGroupsToViewport` so the model can resolve it one step
// earlier and gate the layout on the ROW COUNT it settles at rather than on the
// px it was derived from.
export function resolveFitDefaultCap({
  splitsViewport,
  height,
  visibleGroupCount,
  rowHeight,
  totalOverhead,
  maxRows,
}: {
  splitsViewport: boolean
  height: number
  visibleGroupCount: number
  rowHeight: number
  totalOverhead: number
  maxRows: number
}) {
  return splitsViewport
    ? fitGroupMaxRows({
        height,
        visibleGroupCount,
        rowHeight,
        totalOverhead,
        maxRows,
      })
    : ceilingCap(maxRows)
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
function anyRegionTruncated(map: ReadonlyMap<number, PileupLayoutArrays>) {
  return groupClipSource(map) !== undefined
}

/**
 * A size a user set on one lane: a px band height a drag set, or 'all', the
 * chip's "show all", which lifts the lane's cap to `pileup.maxLayoutHeight`
 * and pads nothing.
 */
export type GroupSize = number | 'all'

// The row caps the per-lane sizes impose. A px size is a BAND height and a cap
// is a row count, so every px between two row boundaries, and every px past
// what the lane's reads fill, names the same caps. A "show all" lane takes the
// ceiling as its own cap, which opts it out of the shared budget and the
// collapse as a px size does, and which reports a clip as the ceiling's, so
// the notice offering to raise it still shows.
export function groupRowCaps({
  sizes,
  ceilingPx,
  rowHeight,
}: {
  sizes: ReadonlyMap<string, GroupSize>
  ceilingPx: number
  rowHeight: number
}) {
  const caps = new Map<string, RowCap>()
  for (const [key, size] of sizes) {
    caps.set(
      key,
      size === 'all'
        ? ceilingCap(maxRowsFor(ceilingPx, rowHeight))
        : overrideCap(maxRowsFor(size, rowHeight)),
    )
  }
  return caps
}
