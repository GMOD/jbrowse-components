import { Instance } from 'mobx-state-tree'
import { LinearGenomeViewStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView'
import { clamp } from '@gmod/jbrowse-core/util'
import { LayoutRecord, VIEW_DIVIDER_HEIGHT } from './model'

const [, TOP, , BOTTOM] = [0, 1, 2, 3]

function cheight(chunk: LayoutRecord) {
  return chunk[BOTTOM] - chunk[TOP]
}
function heightFromSpecificLevel(
  views: Instance<LinearGenomeViewStateModel>[],
  trackConfigId: string,
  level: number,
) {
  const heightUpUntilThisPoint =
    views
      .slice(0, level)
      .map(v => v.height + VIEW_DIVIDER_HEIGHT)
      .reduce((a, b) => a + b, 0) +
    level * 3
  return (
    heightUpUntilThisPoint +
    views[level].headerHeight +
    views[level].scaleBarHeight +
    views[level].getTrackPos(trackConfigId) +
    1
  )
}

export function getPxFromCoordinate(
  view: Instance<LinearGenomeViewStateModel>,
  refName: string,
  coord: number,
) {
  return ((view.bpToPx({ refName, coord }) || {}).offsetPx || 0) - view.offsetPx
}

// get's the yposition of a layout record in a track
export function yPos(
  trackConfigId: string,
  level: number,
  views: Instance<LinearGenomeViewStateModel>[],
  tracks: {
    height: number
    scrollTop: number
  }[], // basic track requirements
  c: LayoutRecord,
) {
  const min = 0
  const max = tracks[level].height

  let offset = 0
  // @ts-ignore
  if (tracks[level].SNPCoverageTrack) {
    // @ts-ignore
    offset = tracks[level].SNPCoverageTrack.height + 5
  }
  return (
    clamp(
      c[TOP] - tracks[level].scrollTop + cheight(c) / 2 + offset,
      min,
      max,
    ) + heightFromSpecificLevel(views, trackConfigId, level)
  )
}
