import { getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import type { LayoutRecord } from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface Display {
  searchFeatureByID?: (str: string) => LayoutRecord
}

interface Track {
  displays: Display[]
  configuration: AnyConfigurationModel
}

// Must match the CSS height of viewDivider in BreakpointSplitView.tsx
export const VIEW_DIVIDER_HEIGHT = 3

// Sentinel y placed in a synthesized LayoutRecord when a feature isn't in its
// track's pileup layout (filtered out, off-display past maxHeight, or not yet
// loaded). `getY` checks for this and snaps the endpoint to the track's bottom
// edge so the connecting spline terminates there instead of being skipped.
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

export function calc(track: Track, f: Feature) {
  return track.displays[0]!.searchFeatureByID?.(f.id())
}

export async function getBlockFeatures(
  model: { views: LinearGenomeViewModel[] },
  track: Track,
) {
  const { views } = model
  const { rpcManager } = getSession(model)
  const sessionId = getRpcSessionId(track)

  return Promise.all(
    views.map(async view =>
      rpcManager.call(sessionId, 'BreakpointGetFeatures', {
        adapterConfig: getConf(track, ['adapter']),
        sessionId,
        regions: view.staticBlocks.contentBlocks,
      }),
    ),
  )
}
