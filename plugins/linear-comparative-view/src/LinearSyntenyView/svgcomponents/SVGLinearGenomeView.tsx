import type { ReactNode } from 'react'

import { getFillProps } from '@jbrowse/core/util'
import {
  SVGGridlines,
  SVGRuler,
  SVGTracks,
} from '@jbrowse/plugin-linear-genome-view'
import { useTheme } from '@mui/material'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  LinearGenomeViewModel,
  TrackLabelMode,
} from '@jbrowse/plugin-linear-genome-view'

export interface ViewDisplayResults {
  view: LinearGenomeViewModel
  data: {
    track: {
      configuration: AnyConfigurationModel
      displays: { height: number }[]
    }
    result: ReactNode
  }[]
}

export default function SVGLinearGenomeView({
  trackLabelOffset,
  fontSize,
  textHeight,
  trackLabels,
  view,
  displayResults,
  rulerHeight,
  shift,
  showGridlines = false,
  tracksHeight,
}: {
  textHeight: number
  trackLabels: TrackLabelMode
  trackLabelOffset: number
  fontSize: number
  view: LinearGenomeViewModel
  displayResults: ViewDisplayResults
  rulerHeight: number
  shift: number
  showGridlines?: boolean
  tracksHeight: number
}) {
  const theme = useTheme()
  return (
    <g transform={`translate(${shift} ${fontSize})`}>
      <g transform={`translate(${trackLabelOffset})`}>
        <text
          x={0}
          fontSize={fontSize}
          {...getFillProps(theme.palette.text.primary)}
        >
          {view.assemblyNames.join(', ')}
        </text>
        <SVGRuler model={displayResults.view} fontSize={fontSize} />
      </g>
      {showGridlines ? (
        <g
          transform={`translate(${trackLabelOffset} ${rulerHeight + fontSize})`}
        >
          <SVGGridlines model={displayResults.view} height={tracksHeight} />
        </g>
      ) : null}
      <g transform={`translate(0 ${rulerHeight + fontSize})`}>
        <SVGTracks
          textHeight={textHeight}
          trackLabels={trackLabels}
          fontSize={fontSize}
          model={displayResults.view}
          displayResults={displayResults.data}
          trackLabelOffset={trackLabelOffset}
        />
      </g>
    </g>
  )
}
