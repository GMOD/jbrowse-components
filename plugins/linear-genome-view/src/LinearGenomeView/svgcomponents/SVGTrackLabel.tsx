import React from 'react'
import { useTheme } from '@mui/material'
import { coarseStripHTML } from '@jbrowse/core/util'

export default function SVGTrackLabel({
  trackLabels,
  trackName,
  fontSize,
  trackLabelOffset,
  x,
}: {
  trackName: string
  trackLabels: string
  fontSize: number
  trackLabelOffset: number
  x: number
}) {
  const theme = useTheme()
  const fill = theme.palette.text.primary
  const xoff = trackLabels === 'overlay' ? 5 : 0
  const yoff = trackLabels === 'offset' ? 5 : 0
  const name = coarseStripHTML(trackName)
  return trackLabels !== 'none' ? (
    <g>
      {trackLabels === 'left' ? (
        <text
          x={trackLabelOffset - 40}
          y={20}
          fill={fill}
          fontSize={fontSize}
          dominantBaseline="hanging"
          textAnchor="end"
        >
          {name}
        </text>
      ) : (
        <text
          x={x + xoff}
          y={yoff}
          fill={fill}
          fontSize={fontSize}
          dominantBaseline="hanging"
        >
          {name}
        </text>
      )}
    </g>
  ) : null
}
