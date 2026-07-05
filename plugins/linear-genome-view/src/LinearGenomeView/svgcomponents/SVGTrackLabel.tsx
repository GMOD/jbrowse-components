import { coarseStripHTML, getFillProps } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import type { TrackLabelMode } from '../types.ts'

export default function SVGTrackLabel({
  trackLabels,
  trackName,
  fontSize,
  trackLabelOffset,
  x,
}: {
  trackName: string
  trackLabels: TrackLabelMode
  fontSize: number
  trackLabelOffset: number
  x: number
}) {
  const theme = useTheme()
  const fillProps = getFillProps(theme.palette.text.primary)
  const xoff = trackLabels === 'overlay' ? 5 : 0
  const yoff = trackLabels === 'offset' ? 5 : 0
  const name = coarseStripHTML(trackName)
  return trackLabels !== 'none' ? (
    trackLabels === 'left' ? (
      <text
        x={trackLabelOffset - 40}
        y={20}
        fontSize={fontSize}
        dominantBaseline="hanging"
        textAnchor="end"
        {...fillProps}
      >
        {name}
      </text>
    ) : (
      <text
        x={x + xoff}
        y={yoff}
        fontSize={fontSize}
        dominantBaseline="hanging"
        {...fillProps}
      >
        {name}
      </text>
    )
  ) : null
}
