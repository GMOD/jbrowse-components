import { getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import type { LayoutRecord } from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// The subset of a track/display the overlays actually read. The LGV's `tracks`
// array is an MST pluggable union, which TS widens to `any`, so naming the
// shape here is what makes these field reads checked at all — see the
// OverlayTrack annotation on getMatchedTracks.
export interface OverlayDisplay {
  height: number
  searchFeatureByID?: (str: string) => LayoutRecord | undefined
  /**
   * whether `searchFeatureByID` currently has a laid-out pileup to search.
   * False while the display holds no data (mid-load, or the region-too-large
   * banner replaced the pileup) — see layoutUnknown. Absent on display types
   * that keep no layout at all, which have no searchFeatureByID either.
   */
  layoutReady?: boolean
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

export interface OverlayTrack {
  /** the track-type name, e.g. 'AlignmentsTrack' — how matches are classified */
  type: string
  minimized: boolean
  displays: OverlayDisplay[]
  configuration: AnyConfigurationModel
}

// Must match the CSS height of viewDivider in BreakpointSplitView.tsx
export const VIEW_DIVIDER_HEIGHT = 3

// Sentinel y placed in a synthesized LayoutRecord when a feature has no row in
// its track's pileup layout: the display keeps no layout at all (paired/arc), or
// the read never reached the fetched data (filterBy and friends). `getY` checks
// for this and snaps the endpoint to the track's bottom edge so the connecting
// spline terminates there instead of being skipped.
//
// NOT the maxHeight case, despite looking identical on screen: a truncated read
// gets layout's `maxRows` overflow sentinel, so it has a row, and
// computeOverlayY's clamp is what puts it on the bottom edge.
//
// Only ever for a feature the layout genuinely lacks — never for one whose
// position is merely unknown because there is no layout yet. See layoutUnknown.
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
export function findFeatureViewLevel(
  views: {
    bpToPx: (a: { refName: string; coord: number }) => unknown
  }[],
  refName: string,
  coord: number,
) {
  for (let level = 0; level < views.length; level++) {
    if (views[level]!.bpToPx({ refName, coord })) {
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

// A failed `calc` means two very different things. If the display has a layout,
// the feature really is off-display (filtered, past maxHeight) and the overlay
// draws to the bottom edge — that IS the signal the segment exists. If the
// display has no layout at all right now, the position is merely unknown: the
// data was cleared for a refetch, or the region-too-large banner replaced the
// pileup. Snapping to the bottom edge then collapses every connection onto one
// line for the length of the transition, so callers drop them instead.
export function layoutUnknown(track: OverlayTrack) {
  const d = track.displays[0]!
  return d.searchFeatureByID !== undefined && !d.layoutReady
}

export async function getBlockFeatures(
  model: { views: LinearGenomeViewModel[] },
  track: OverlayTrack,
) {
  const { views } = model
  const { rpcManager } = getSession(model)
  const sessionId = getRpcSessionId(track)

  return Promise.all(
    views.map(async view =>
      rpcManager.call(sessionId, 'BreakpointGetFeatures', {
        adapterConfig: getConf(track, ['adapter']),
        regions: view.staticBlocks.contentBlocks,
      }),
    ),
  )
}
