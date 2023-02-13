import React from 'react'
import { useTheme } from '@mui/material'

export default function SVGTrackLabel({
  trackLabels,
  trackName,
  fontSize,
  x,
}: {
  trackName: string
  trackLabels: string
  fontSize: number
  x: number
}) {
  const theme = useTheme()
  const fill = theme.palette.text.primary
  const xoff = trackLabels === 'overlay' ? 5 : 0
  return trackLabels !== 'none' ? (
    <g>
      <text x={x + xoff} y={fontSize + 2} fill={fill} fontSize={fontSize}>
        {trackName}
      </text>
    </g>
  ) : null
}
