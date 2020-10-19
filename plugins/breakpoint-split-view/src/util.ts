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
  return views[level].trackRefs[trackConfigId].getBoundingClientRect().top
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
    SNPCoverageTrack?: { height: number }
    showCoverage?: boolean
  }[], // basic track requirements
  c: LayoutRecord,
) {
  const min = 0
  const max = tracks[level].height
  let offset = 0
  const { showCoverage, SNPCoverageTrack } = tracks[level]
  if (SNPCoverageTrack && showCoverage) {
    offset = SNPCoverageTrack.height + 5
  }
  return (
    clamp(
      c[TOP] - tracks[level].scrollTop + cheight(c) / 2 + offset,
      min,
      max,
    ) +
    heightFromSpecificLevel(views, trackConfigId, level) +
    tracks[level].scrollTop
  )
}

// we combo a useEffect and useState combo to force rerender on snap
// changing. the setup of this being a useEffect+useState makes it
// re-render once the useEffect is called, which is generally the
// "next frame". If we removed the below use
export const useNextFrame = (variable: unknown) => {
  const [, setNextFrameState] = useState()
  useEffect(() => {
    setNextFrameState(variable)
  }, [variable])
}
