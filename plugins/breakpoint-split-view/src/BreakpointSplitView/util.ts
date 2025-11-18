import { useLayoutEffect, useReducer } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { clamp, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import { LAYOUT_BOTTOM, LAYOUT_TOP } from './constants'

import type { LayoutRecord } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface Display {
  height: number
  scrollTop: number
  SNPCoverageDisplay?: { height: number }
  notReady?: () => boolean
  searchFeatureByID?: (str: string) => LayoutRecord
}

interface Track {
  displays: Display[]
  configuration: AnyConfigurationModel
}

function cheight(chunk: LayoutRecord) {
  return chunk[LAYOUT_BOTTOM] - chunk[LAYOUT_TOP]
}

export function heightFromSpecificLevel(
  views: LGV[],
  trackId: string,
  level: number,
  getYPosOverride?: (trackId: string, level: number) => number,
) {
  return getYPosOverride
    ? getYPosOverride(trackId, level)
    : views[level]!.trackRefs[trackId]?.getBoundingClientRect().top || 0
}

export function getPxFromCoordinate(view: LGV, refName: string, coord: number) {
  return (view.bpToPx({ refName, coord })?.offsetPx || 0) - view.offsetPx
}

// get's the yposition of a layout record in a track
export function yPos(
  trackId: string,
  level: number,
  views: LGV[],
  tracks: Track[],
  c: LayoutRecord,
  getYPosOverride?: (trackId: string, level: number) => number,
) {
  const display = tracks[level]!.displays[0]!
  const min = 0
  const max = display.height
  let offset = 0
  const { SNPCoverageDisplay } = display
  if (SNPCoverageDisplay) {
    offset = SNPCoverageDisplay.height
  }
  const yPos = getYPosOverride ? 0 : display.scrollTop
  return (
    clamp(c[LAYOUT_TOP] - yPos + cheight(c) / 2 + offset, min, max) +
    heightFromSpecificLevel(views, trackId, level, getYPosOverride) +
    display.scrollTop
  )
}

// Forces a re-render on the next animation frame when the variable changes.
// This is needed to ensure getBoundingClientRect() calls get accurate DOM
// positions after the view has settled. Uses requestAnimationFrame to schedule
// the re-render at the optimal time in the browser's rendering cycle.
export const useNextFrame = (variable: unknown) => {
  const [, forceUpdate] = useReducer(x => x + 1, 0)

  useLayoutEffect(() => {
    const rafId = requestAnimationFrame(() => {
      forceUpdate()
    })
    return () => {
      cancelAnimationFrame(rafId)
    }
  }, [variable])
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
    views.flatMap(
      async view =>
        (await rpcManager.call(sessionId, 'CoreGetFeatures', {
          adapterConfig: getConf(track, ['adapter']),
          sessionId,
          regions: view.staticBlocks.contentBlocks,
        })) as Feature[][],
    ),
  )
}
