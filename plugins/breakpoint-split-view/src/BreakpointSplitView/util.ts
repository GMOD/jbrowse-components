import { getConf } from '@jbrowse/core/configuration'

import type { LayoutRecord } from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { FetchContext } from '@jbrowse/core/util/fetchContext'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

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
interface OverlayDisplayBase {
  height: number
  scrollTop?: number
  regionTooLarge?: boolean
  /** height of the coverage subtrack, on displays that have one */
  coverageDisplayHeight?: number
  /**
   * LinearAlignmentsDisplay's view-as-pairs / link-supplementary-alignments
   * setting; absent on display types that don't link reads. Mirrors that
   * plugin's LinkedReadsMode structurally — this plugin has no dependency on
   * plugin-alignments, so a rename there surfaces as `undefined` here, not as
   * a type error.
   */
  linkedReads?: 'off' | 'normal'
}

/** A display that indexes its features, so an overlay can ask where one landed. */
interface SearchableOverlayDisplay extends OverlayDisplayBase {
  searchFeatureByID: (str: string) => LayoutRecord | undefined
  /** whether searchFeatureByID has a laid-out pileup to search right now */
  layoutReady: boolean
}

/** A display that keeps no feature layout at all (the paired/arc displays). */
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

// Vertical screen position (relative to the overlay SVG) of an overlay endpoint
// for a feature laid out at `layout` in a track of the given `height`.
//   - Off-display features (see makeOffscreenLayout) snap to the bottom edge.
//   - Otherwise it's the layout rectangle's vertical midpoint, shifted by the
//     track's vertical scroll and its coverage-subtrack offset.
// The result is always clamped into [yOffset + coverageOffset, yOffset + height]
// so the endpoint lands inside the visible pileup. AlignmentConnections relies
// on the `<= yOffset + height` half of that invariant.
export function computeOverlayY({
  yOffset,
  height,
  coverageOffset,
  scrollTop,
  layout,
}: {
  yOffset: number
  height: number
  coverageOffset: number
  scrollTop: number
  layout: LayoutRecord
}) {
  if (isOffscreenLayout(layout)) {
    return yOffset + height
  }
  const top = layout[1]
  const bot = layout[3]
  const mid = top - scrollTop + (bot - top) / 2 + coverageOffset
  return (
    yOffset + (mid < coverageOffset ? coverageOffset : Math.min(mid, height))
  )
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
 * `regionsPerView` is passed rather than read off the views here, and that is
 * the point: the caller is an autorun, and this read is what makes a pan
 * refetch. It used to happen on this line, which tracked only by luck of the
 * call ordering — the caller's `tracks.map` runs its async bodies synchronously
 * as far as their first await, so the read landed inside the autorun's tracked
 * window with three frames and two files between it and the `autorun(` that
 * depended on it. Hoisting a single read past an await anywhere along that
 * chain would have stopped every refetch on pan, silently and with nothing
 * failing.
 */
export async function getBlockFeatures(
  track: OverlayTrack,
  regionsPerView: Region[][],
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
    regionsPerView.map(regions =>
      ctx.callRpc('BreakpointGetFeatures', {
        adapterConfig: getConf(track, ['adapter']),
        regions,
      }),
    ),
  )
}
