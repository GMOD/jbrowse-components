import type { ReactNode } from 'react'

import { exportMargin } from '@jbrowse/core/svg/constants'
import { getEnv, getFillProps } from '@jbrowse/core/util'
import {
  SVGGridlines,
  SVGHighlights,
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
  const theme = useTheme()
  const { view } = displayResults
  const { pluginManager } = getEnv(view)
  const clipId = `highlight-clip-${view.id}`
  const bookmarkHighlights = pluginManager.evaluateExtensionPoint(
    'LinearGenomeView-HighlightSVGComponent',
    [] as ReactNode[],
    { model: view, height: tracksHeight },
  )
  return (
    <g transform={`translate(${exportMargin} ${fontSize})`}>
      <g transform={`translate(${trackLabelOffset})`}>
        <text
          x={0}
          fontSize={fontSize}
          {...getFillProps(theme.palette.text.primary)}
        >
          {view.assemblyNames.join(', ')}
        </text>
        <SVGRuler model={view} fontSize={fontSize} />
      </g>
      {showGridlines ? (
        <g transform={`translate(${trackLabelOffset} ${rulerHeight})`}>
          <SVGGridlines model={view} height={tracksHeight} />
        </g>
      ) : null}
      <g transform={`translate(0 ${rulerHeight})`}>
        <SVGTracks
          textHeight={textHeight}
          trackLabels={trackLabels}
          fontSize={fontSize}
          model={view}
          displayResults={displayResults.data}
          trackLabelOffset={trackLabelOffset}
        />
      </g>
      <g transform={`translate(${trackLabelOffset} ${rulerHeight})`}>
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={view.width} height={tracksHeight} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <SVGHighlights model={view} height={tracksHeight} />
          {bookmarkHighlights}
        </g>
      </g>
    </g>
  )
}
