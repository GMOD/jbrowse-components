import { useState, useEffect } from 'react'
import { clamp } from '@jbrowse/core/util'
import type { LayoutRecord } from './model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals

type LGV = LinearGenomeViewModel

interface Display {
  height: number
  scrollTop: number
  SNPCoverageDisplay?: { height: number }
}

interface Track {
  displays: Display[]
}

const [, TOP, , BOTTOM] = [0, 1, 2, 3] as const

function cheight(chunk: LayoutRecord) {
  return chunk[BOTTOM] - chunk[TOP]
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
    clamp(c[TOP] - yPos + cheight(c) / 2 + offset, min, max) +
    heightFromSpecificLevel(views, trackId, level, getYPosOverride) +
    display.scrollTop
  )
}

// we combo a useEffect and useState combo to force rerender on snap changing.
// the setup of this being a useEffect+useState makes it re-render once the
// useEffect is called, which is generally the "next frame". If we removed the
// below use
export const useNextFrame = (variable: unknown) => {
  const [, setNextFrameState] = useState<unknown>()
  useEffect(() => {
    setNextFrameState(variable)
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
