import { Instance } from 'mobx-state-tree'
import { LinearGenomeViewStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView'
import { clamp, bpToPx } from '@gmod/jbrowse-core/util'
import { LayoutRecord } from './model'

const [, TOP, , BOTTOM] = [0, 1, 2, 3]

function cheight(chunk: LayoutRecord) {
  return chunk[BOTTOM] - chunk[TOP]
}
function heightFromSpecificLevel(
  views: Instance<LinearGenomeViewStateModel>[],
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
    views[level].getTrackPos(trackConfigId) +
    1
  )
}

// TODO: this is only working because the breakpoint
// split view is displaying a single refseq on the top region
// need to update to use a proper bpToPx which is in dev
export function getPxFromCoordinate(
  view: Instance<LinearGenomeViewStateModel>,
  coord: number,
) {
  const region = { start: 0, end: view.totalBp }
  const { bpPerPx, horizontallyFlipped, offsetPx } = view
  return bpToPx(coord, region, bpPerPx, horizontallyFlipped) - offsetPx
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
    clamp(c[TOP] - tracks[level].scrollTop + cheight(c) / 2, min, max) +
    heightFromSpecificLevel(views, trackConfigId, level)
  )
}
