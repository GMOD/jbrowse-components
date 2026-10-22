import { getConf } from '@jbrowse/core/configuration'
import {
  bpToPx,
  getLayoutHighlightCoords,
} from '@jbrowse/core/util/Base1DUtils'

import type { ReadSource } from './readChains.ts'
import type { LayoutRecord, OverlayKind, OverlayLevel } from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { ViewLayout } from '@jbrowse/core/util/Base1DUtils'
import type { FetchContext } from '@jbrowse/core/util/fetchContext'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

export function overlayKind(trackType: string): OverlayKind | undefined {
  return trackType === 'AlignmentsTrack'
    ? 'alignment'
    : trackType === 'VariantTrack'
      ? 'variant'
      : undefined
}

/**
 * The one thing a row's assembly is asked for when placing a feature: the total
 * refName resolver. Structural so the per-row array can be built from anything
 * and so a test does not need an assembly model.
 */
export interface RefNameCanonicalizer {
  getCanonicalRefName2: (refName: string) => string
}

// The subset of a track/display the overlays actually read. The LGV's `tracks`
// array is an MST pluggable union, which TS widens to `any`, so naming the
// shape here is what makes these field reads checked at all — see the
// OverlayTrack annotation on getMatchedTracks.
interface OverlayDisplayBase extends Partial<ReadSource> {
  height: number
  scrollTop?: number
  regionTooLarge?: boolean
  /** height of the coverage subtrack, on displays that have one */
  coverageDisplayHeight?: number
  /**
   * What the display's own connector overlay draws, LinearAlignmentsDisplay's
   * `bezierArcScope`: `'all'` under curved connectors, `'crossRegion'` in
   * chain layout, where the per-region line covers the rest. Structural, since
   * this plugin has no dependency on plugin-alignments, so a rename there
   * surfaces as `undefined` here, not as a type error.
   */
  bezierArcScope?: 'all' | 'crossRegion' | 'none'
  /** the "Filter by..." contract, `JexlFilterSource`, on displays that have one */
  configuredFilters?: () => string[]
  withFeatureById?: (
    featureId: string,
    onFeat: (feat: Feature) => void,
  ) => Promise<void>
}

// The filters the display applies, so the overlay draws no connector for a
// feature the track has filtered out.
export function overlayJexlFilters(d: OverlayDisplayBase | undefined) {
  return d?.configuredFilters?.() ?? []
}

/** A display that indexes its features, so an overlay can ask where one landed. */
interface SearchableOverlayDisplay extends OverlayDisplayBase {
  searchFeatureByID: (str: string) => LayoutRecord | undefined
  /** whether searchFeatureByID has a laid-out pileup to search right now */
  layoutReady: boolean
}

/** A display that keeps no feature layout at all, or lays out reads instead. */
interface OpaqueOverlayDisplay extends OverlayDisplayBase {
  searchFeatureByID?: undefined
  layoutReady?: undefined
}

// Two variants, not one shape with two optionals, so `layoutUnknown` narrows to
// a required boolean instead of a `boolean | undefined` whose absence is
// indistinguishable from `false` — i.e. from "no layout", which drops the curve.
export type OverlayDisplay = SearchableOverlayDisplay | OpaqueOverlayDisplay

// `IStateTreeNode`, never `IAnyStateTreeNode` — the latter resolves to `any` and
// would turn off checking for every member below. Duck-typed like the rest of
// this file, but a node: `getConf` reads its config, and the overlay fetch roots
// its `FetchContext` here because `rpcSessionId` is a track's and nothing above
// it declares one.
export interface OverlayTrack extends IStateTreeNode {
  /** the track-type name, e.g. 'AlignmentsTrack' — how matches are classified */
  type: string
  minimized: boolean
  displays: OverlayDisplay[]
  configuration: AnyConfigurationModel
}

export function readSourceOf(
  display: OverlayDisplay | undefined,
): ReadSource | undefined {
  const { readArraysByGroup, loadedRegions, readLayoutRecord } = display ?? {}
  return readArraysByGroup && loadedRegions && readLayoutRecord
    ? { readArraysByGroup, loadedRegions, readLayoutRecord }
    : undefined
}

// Height of the bar between stacked views; also the CSS height of viewDivider in
// BreakpointSplitView.tsx, which imports this rather than restating it
export const VIEW_DIVIDER_HEIGHT = 3

// Sentinel y for a feature with no row in its track's layout; `getY` snaps it to
// the track's bottom edge so the spline terminates there instead of being
// skipped. Only for a layout that genuinely lacks the feature — never for one
// whose position is merely unknown because no layout exists (see layoutUnknown).
//
// NOT the maxHeight case, despite looking identical on screen: a truncated read
// gets layout's `maxRows` overflow sentinel, so it has a row, and it's
// computeOverlayY's clamp that puts it on the bottom edge.
export const OFFSCREEN_Y_SENTINEL = Number.POSITIVE_INFINITY

export function makeOffscreenLayout(
  startBp: number,
  endBp: number,
): LayoutRecord {
  return [startBp, OFFSCREEN_Y_SENTINEL, endBp, OFFSCREEN_Y_SENTINEL]
}

export function isOffscreenLayout(c: LayoutRecord) {
  return c[1] === OFFSCREEN_Y_SENTINEL
}

/**
 * Where a bp lands in a row, in px from its visible left edge, and whether the
 * region holding it is reversed. The orientation comes from the region that
 * placed the bp, since a junction's end sits on the seam between two regions
 * and the pixel there belongs to the next one.
 */
export function placeOnRow(layout: ViewLayout, refName: string, coord: number) {
  const hit = bpToPx({ refName, coord, self: layout })
  return hit
    ? {
        x: hit.offsetPx - layout.offsetPx,
        reversed: !!layout.displayedRegions[hit.index]!.reversed,
      }
    : undefined
}

// Vertical screen position (relative to the overlay SVG) of an overlay endpoint
// for a feature laid out at `layout` in a track of the given `height`.
//   - Off-display features (see makeOffscreenLayout) snap to the bottom edge.
//   - Otherwise it's the point `at` of the way down the layout rectangle (its
//     midpoint by default), shifted by the track's vertical scroll and its
//     coverage-subtrack offset.
// The result is always clamped into [yOffset + coverageOffset, yOffset + height]
// so the endpoint lands inside the visible pileup. AlignmentConnections relies
// on the `<= yOffset + height` half of that invariant.
export function computeOverlayY({
  yOffset,
  height,
  coverageOffset,
  scrollTop,
  layout,
  at = 0.5,
}: {
  yOffset: number
  height: number
  coverageOffset: number
  scrollTop: number
  layout: LayoutRecord
  at?: number
}) {
  if (isOffscreenLayout(layout)) {
    return yOffset + height
  }
  const top = layout[1]
  const bot = layout[3]
  const y = top - scrollTop + (bot - top) * at + coverageOffset
  return yOffset + (y < coverageOffset ? coverageOffset : Math.min(y, height))
}

// Horizontal screen position of an overlay endpoint, the sibling of
// computeOverlayY and clamped for the same reason.
//
// A feature with no row in any track's layout is off-display in BOTH axes, and
// computeOverlayY deliberately snaps its y to the track's bottom edge so the
// curve terminating there is the one sign the segment exists. Leaving x at the
// true coordinate defeats that: the point it terminates at is outside the panel,
// so the curve simply leaves the frame on a diagonal and the reader sees a line
// to nowhere rather than a marker at the edge. Clamping x puts the terminus back
// in view, on the side the segment actually lies.
//
// An on-display feature keeps its true x even when that is off-panel — a long
// read whose alignment runs past the window has a real row, a real y, and an x
// that means something. Only the synthesized record is clamped.
export function computeOverlayX(
  x: number,
  width: number,
  layout: LayoutRecord,
) {
  return isOffscreenLayout(layout) ? Math.min(Math.max(x, 0), width) : x
}

// Screen rect of one laid-out feature — the rectangle computeOverlayY resolves
// down to a single midpoint, kept whole so the hover highlight can box the read
// a connector points at.
//
// getLayoutHighlightCoords rather than a bpToPx per edge: a read in a breakpoint
// panel routinely starts before the displayed region and ends after it, and
// bpToPx answers undefined for such an edge — which would drop the box for
// exactly the long reads a split view is opened to look at. It carries the
// min-width floor and the reversed-view handling too.
//
// Undefined once the clamps close the rect: an off-display segment (see
// makeOffscreenLayout), one scrolled out of its pileup, or one whose span lies
// entirely off the panel. There is no read on screen to box in any of those, and
// the connector terminating on the panel's bottom edge is already the only sign
// an off-display segment exists.
export function computeOverlayRect({
  level,
  layout,
  refName,
  viewLayout,
}: {
  level: OverlayLevel
  layout: LayoutRecord
  refName: string
  viewLayout: ViewLayout
}) {
  const [startBp, layoutTop, endBp, layoutBottom] = layout
  const coords = isOffscreenLayout(layout)
    ? undefined
    : getLayoutHighlightCoords(viewLayout, {
        refName,
        start: startBp,
        end: endBp,
      })
  if (coords) {
    const { yOffset, height, coverageOffset, scrollTop } = level
    const left = Math.max(coords.left, 0)
    const right = Math.min(coords.left + coords.width, viewLayout.width)
    const top = Math.max(layoutTop - scrollTop + coverageOffset, coverageOffset)
    const bottom = Math.min(layoutBottom - scrollTop + coverageOffset, height)
    if (right > left && bottom > top) {
      return {
        x: left,
        y: yOffset + top,
        width: right - left,
        height: bottom - top,
      }
    }
  }
  return undefined
}

// Find which row (level) of the breakpoint split view a feature "belongs to"
// by checking which view's `displayedRegions` contain the feature's position.
// Assumption: `view.bpToPx({ refName, coord })` returns truthy iff the coord
// falls inside one of that view's displayedRegions — i.e., the level is
// determined by region membership, NOT by current scroll/zoom. The feature
// may still be horizontally off-screen within the chosen level.
//
// `refName` arrives in the file's spelling and `displayedRegions` holds the
// assembly's, so it is resolved once per level against THAT row's assembly:
// the rows are independently assembly-picked, and one shared resolver answers
// for one of them and drops every contig belonging to the rest.
export function findFeatureViewLevel(
  views: {
    bpToPx: (a: { refName: string; coord: number }) => unknown
  }[],
  assemblies: (RefNameCanonicalizer | undefined)[],
  refName: string,
  coord: number,
) {
  for (let level = 0; level < views.length; level++) {
    const canonical =
      assemblies[level]?.getCanonicalRefName2(refName) ?? refName
    if (views[level]!.bpToPx({ refName: canonical, coord })) {
      return level
    }
  }
  return undefined
}

// https://stackoverflow.com/a/49186706/2129219 the array-intersection package
// on npm has a large kb size, and we are just intersecting open track ids so
// simple is better
export function intersect<T>(
  cb: (l: T) => string,
  a1: T[] = [],
  a2: T[] = [],
  ...rest: T[][]
): T[] {
  const ids = new Set(a2.map(elt => cb(elt)))
  const a12 = a1.filter(value => ids.has(cb(value)))
  return rest.length === 0 ? a12 : intersect(cb, a12, ...rest)
}

export function calc(track: OverlayTrack, f: Feature) {
  return track.displays[0]!.searchFeatureByID?.(f.id())
}

// Everything that stays inside one row is already connected by the display
// itself, whether chained onto rows or curved over the pileup: the one scope
// that draws nothing is the one that leaves the row to this overlay.
export function linksOwnReads(d: OverlayDisplay) {
  return (d.bezierArcScope ?? 'none') !== 'none'
}

// A failed `calc` is ambiguous. With a layout, the feature really is off-display
// and the bottom-edge curve is the signal it exists. With no layout — data
// cleared, or the too-large banner up — its position is merely unknown, and
// snapping collapses every connection onto one line until the data lands.
export function layoutUnknown(track: OverlayTrack) {
  const d = track.displays[0]!
  // narrows to SearchableOverlayDisplay, where layoutReady is a required boolean
  return d.searchFeatureByID !== undefined && !d.layoutReady
}

/**
 * One track's features across both rows.
 *
 * `regionsPerView` is passed rather than read off the views here, because the
 * caller is an autorun, and that read makes a pan refetch. It used to happen on this line, which tracked only by luck of the
 * call ordering — the caller's `tracks.map` runs its async bodies synchronously
 * as far as their first await, so the read landed inside the autorun's tracked
 * window with three frames and two files between it and the `autorun(` that
 * depended on it. Hoisting a single read past an await anywhere along that
 * chain would have stopped every refetch on pan, and no test would have
 * failed.
 */
export async function getBlockFeatures(
  track: OverlayTrack,
  regionsPerView: Region[][],
  jexlFiltersPerView: string[][],
  // This track's own status slot, from the caller's `fanOutStatus`, and a
  // context rebuilt on the TRACK — see the caller. Both views run concurrently
  // on the one slot deliberately: a second fan-out here would aggregate a pair
  // that is already one operation from the chip's point of view.
  //
  // `ctx.callRpc` rather than a hand-threaded `rpcManager.call`, so the stop
  // token and the status callback cannot be dropped from one of the two calls
  // — the failure that envelope exists to make inexpressible.
  ctx: FetchContext,
) {
  return Promise.all(
    regionsPerView.map((regions, level) =>
      ctx.callRpc('BreakpointGetFeatures', {
        adapterConfig: getConf(track, ['adapter']),
        regions,
        jexlFilters: jexlFiltersPerView[level],
      }),
    ),
  )
}

// Only `minimized` is needed, so that's all this asks for — a caller with any
// track-ish thing (including a test double) can use it.
export function isLevelPairMinimized(
  tracks: Pick<OverlayTrack, 'minimized'>[],
  level1: number,
  level2: number,
) {
  return !!(tracks[level1]?.minimized || tracks[level2]?.minimized)
}
