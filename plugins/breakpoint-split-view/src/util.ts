import { useState, useEffect } from 'react'
import { Instance } from 'mobx-state-tree'
import { LinearGenomeViewStateModel } from '@jbrowse/plugin-linear-genome-view'
import { clamp } from '@jbrowse/core/util'
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
  const track = views[level].trackRefs[trackConfigId]
  return track?.getBoundingClientRect().top || 0
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
    displays: [
      {
        height: number
        scrollTop: number
        SNPCoverageDisplay?: { height: number }
        showCoverage?: boolean
      },
    ]
  }[], // basic track requirements
  c: LayoutRecord,
) {
  const display = tracks[level].displays[0]
  const min = 0
  const max = display.height
  let offset = 0
  const { showCoverage, SNPCoverageDisplay } = display
  if (SNPCoverageDisplay && showCoverage) {
    offset = SNPCoverageDisplay.height + 5
  }
  return (
    clamp(c[TOP] - display.scrollTop + cheight(c) / 2 + offset, min, max) +
    heightFromSpecificLevel(views, trackConfigId, level) +
    display.scrollTop
  )
}

// we combo a useEffect and useState combo to force rerender on snap
// changing. the setup of this being a useEffect+useState makes it
// re-render once the useEffect is called, which is generally the
// "next frame". If we removed the below use
export const useNextFrame = (variable: unknown) => {
  const [, setNextFrameState] = useState<unknown>()
  useEffect(() => {
    setNextFrameState(variable)
  }, [variable])
}
