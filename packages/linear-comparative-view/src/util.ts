import { Instance } from 'mobx-state-tree'
import { LinearGenomeViewStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView'
import { clamp } from '@gmod/jbrowse-core/util'
import { LayoutRecord } from './LinearComparativeView/model'
import { ReducedLinearGenomeViewModel } from './LinearSyntenyRenderer/LinearSyntenyRenderer'

const [, TOP, , BOTTOM] = [0, 1, 2, 3]

export function cheight(chunk: LayoutRecord) {
  return chunk[BOTTOM] - chunk[TOP]
}
function heightFromSpecificLevel(
  views: ReducedLinearGenomeViewModel[],
  trackConfigId: string,
  level: number,
) {
  const heightUpUntilThisPoint = views
    .slice(0, level)
    .map(v => v.height + 7)
    .reduce((a, b) => a + b, 0)
  return (
    heightUpUntilThisPoint +
    views[level].headerHeight +
    views[level].scaleBarHeight +
    getTrackPos(views[level], trackConfigId) +
    1
  )
}

export function getTrackPos(
  view: ReducedLinearGenomeViewModel,
  trackConfigId: string,
) {
  const idx = view.tracks.findIndex(t => t.trackId === trackConfigId)
  let accum = 0
  for (let i = 0; i < idx; i += 1) {
    accum += view.tracks[i].height + 3 // +1px for trackresizehandle
  }
  return accum
}

export function getPxFromCoordinate(
  view: ReducedLinearGenomeViewModel,
  refName: string,
  coord: number,
) {
  return (
    ((bpToPx(view, { refName, coord }) || {}).offsetPx || 0) - view.offsetPx
  )
}

// get's the yposition of a layout record in a track
export function yPos(
  trackConfigId: string,
  level: number,
  views: Instance<LinearGenomeViewStateModel>[],
  tracks: { height: number; scrollTop: number }[], // basic track requirements
  c: LayoutRecord,
) {
  const min = 0
  const max = tracks[level].height
  return (
    clamp(c[TOP] - tracks[level].scrollTop, min, max) +
    heightFromSpecificLevel(views, trackConfigId, level)
  )
}

function bpToPx(
  view: ReducedLinearGenomeViewModel,
  { refName, coord }: { refName: string; coord: number },
) {
  let offsetBp = 0
  const displayedRegionsInOrder = view.reversed
    ? view.displayedRegions.reverse()
    : view.displayedRegions
  const index = displayedRegionsInOrder.findIndex(r => {
    if (refName === r.refName && coord >= r.start && coord <= r.end) {
      offsetBp += view.reversed ? r.end - coord : coord - r.start
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
