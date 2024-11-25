import React from 'react'
import { getFillProps } from '@jbrowse/core/util'
import { SVGTracks, SVGRuler } from '@jbrowse/plugin-linear-genome-view'
import { useTheme } from '@mui/material'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export default function SVGLinearGenomeView({
  trackLabelOffset,
  fontSize,
  textHeight,
  trackLabels,
  view,
  displayResults,
  rulerHeight,
  shift,
}: {
  textHeight: number
  trackLabels: string
  trackLabelOffset: number
  fontSize: number
  view: LinearGenomeViewModel

  displayResults: any
  rulerHeight: number
  shift: number
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
