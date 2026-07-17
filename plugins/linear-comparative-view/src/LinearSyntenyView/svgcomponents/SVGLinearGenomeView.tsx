import { exportMargin } from '@jbrowse/core/svg/constants'
import {
  SVGHighlightsOverlay,
  SVGView,
} from '@jbrowse/plugin-linear-genome-view'

import type {
  LinearGenomeViewModel,
  SvgDisplayResult,
  TrackLabelMode,
} from '@jbrowse/plugin-linear-genome-view'

export interface ViewDisplayResults {
  view: LinearGenomeViewModel
  data: SvgDisplayResult[]
}

export default function SVGLinearGenomeView({
  trackLabelOffset,
  fontSize,
  textHeight,
  trackLabels,
  displayResults,
  rulerHeight,
  showGridlines = false,
  tracksHeight,
}: {
  textHeight: number
  trackLabels: TrackLabelMode
  trackLabelOffset: number
  fontSize: number
  displayResults: ViewDisplayResults
  rulerHeight: number
  showGridlines?: boolean
  tracksHeight: number
}) {
  const { view } = displayResults
  return (
    <g transform={`translate(${exportMargin} ${fontSize})`}>
      <SVGView
        view={view}
        displayResults={displayResults.data}
        fontSize={fontSize}
        textHeight={textHeight}
        trackLabels={trackLabels}
        trackLabelOffset={trackLabelOffset}
        contentTop={rulerHeight}
        tracksHeight={tracksHeight}
        showGridlines={showGridlines}
        leftBuffer={exportMargin}
      />
      <g transform={`translate(${trackLabelOffset} ${rulerHeight})`}>
        <SVGHighlightsOverlay model={view} tracksHeight={tracksHeight} />
      </g>
    </g>
  )
}
