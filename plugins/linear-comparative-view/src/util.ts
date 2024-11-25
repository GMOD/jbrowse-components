import { clamp } from '@jbrowse/core/util'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { Region } from '@jbrowse/core/util/types'

export type LayoutRecord = [number, number, number, number]

export interface ReducedLinearGenomeView {
  bpPerPx: number
  offsetPx: number
  staticBlocks: Region[]
  dynamicBlocks: Region[]
  displayedRegions: Region[]
  headerHeight: number
  scaleBarHeight: number
  height: number
  features: Feature[]
  tracks: {
    scrollTop: number
    height: number
    configuration: string
    skip: number
  }[]
}

const [, TOP, , BOTTOM] = [0, 1, 2, 3] as const

export function cheight(chunk: LayoutRecord) {
  return chunk[BOTTOM] - chunk[TOP]
}
function heightFromSpecificLevel(
  views: ReducedLinearGenomeView[],
  trackConfigId: string,
  level: number,
) {
  const heightUpUntilThisPoint = views
    .slice(0, level)
    .map(v => v.height + 7)
    .reduce((a, b) => a + b, 0)

  const v = views[level]!
  return (
    heightUpUntilThisPoint +
    v.headerHeight +
    v.scaleBarHeight +
    getTrackPos(v, trackConfigId) +
    1
  )
}

export function getTrackPos(
  view: ReducedLinearGenomeView,
  trackConfigId: string,
) {
  const idx = view.tracks.findIndex(t => t.configuration === trackConfigId)
  let accum = 0
  for (let i = 0; i < idx; i += 1) {
    accum += view.tracks[i]!.height + 3 // +1px for trackresizehandle
  }
  return accum
}

// Uses bpToPx to get the screen pixel coordinates but ignores some conditions
// where bpToPx could return undefined
export function getPxFromCoordinate(
  view: ReducedLinearGenomeView,
  refName: string,
  coord: number,
) {
  return (bpToPx(view, { refName, coord })?.offsetPx || 0) - view.offsetPx
}

// Retrieves the y-position of a layout record in a track
// If track not found returns 0
export function overlayYPos(
  trackConfigId: string,
  level: number,
  views: ReducedLinearGenomeView[],
  c: LayoutRecord,
  cond: boolean,
) {
  const track = views[level]!.tracks.find(
    t => t.configuration === trackConfigId,
  )
  const ypos = track
    ? clamp(c[TOP] - (track.scrollTop || 0), 0, track.height) +
      heightFromSpecificLevel(views, trackConfigId, level) +
      track.skip
    : 0

  return ypos + (cond ? cheight(c) : 0)
}

// Returns the pixel screen position of a refName:coord input, or undefined if
// the input could not be located. Uses view.displayedRegions as a representation
// of what is on the screen
//
// Note: does not consider that this refName:coord input could multi-match
function bpToPx(
  view: ReducedLinearGenomeView,
  { refName, coord }: { refName: string; coord: number },
) {
  let offsetBp = 0

  const index = view.displayedRegions.findIndex(r => {
    if (refName === r.refName && coord >= r.start && coord <= r.end) {
      offsetBp += coord - r.start
      return true
    }
    offsetBp += r.end - r.start
    return false
  })
  const foundRegion = view.displayedRegions[index]
  if (foundRegion) {
    return {
      index,
      offsetPx: Math.round(offsetBp / view.bpPerPx),
    }
  }
  return undefined
}

// Returns either 0 or height depending on condition
export function interstitialYPos(cond: boolean, height: number) {
  return cond ? 0 : height
}
