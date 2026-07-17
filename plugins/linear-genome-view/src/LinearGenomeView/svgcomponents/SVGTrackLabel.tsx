import { stripAlpha } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import { TRACK_LABEL_GAP } from './util.ts'

import type { TrackLabelMode } from '../types.ts'

// Where the label sits, per mode. 'left' right-aligns in the gutter
// trackLabelLeftOffset reserved (hence the shared TRACK_LABEL_GAP); the other
// modes hang off the leftmost visible content at `x`, either just above the
// track body ('offset') or inset over it ('overlay').
function labelPosition(
  trackLabels: TrackLabelMode,
  trackLabelOffset: number,
  x: number,
) {
  return trackLabels === 'left'
    ? {
        x: trackLabelOffset - TRACK_LABEL_GAP,
        y: 20,
        textAnchor: 'end' as const,
      }
    : {
        x: x + (trackLabels === 'overlay' ? 5 : 0),
        y: trackLabels === 'offset' ? 5 : 0,
        // left-aligned is the SVG default; omit rather than spend bytes on it
        textAnchor: undefined,
      }
}

export default function SVGTrackLabel({
  trackLabels,
  trackName,
  fontSize,
  trackLabelOffset,
  x,
}: {
  // already run through svgTrackName (HTML stripped)
  trackName: string
  trackLabels: TrackLabelMode
  fontSize: number
  trackLabelOffset: number
  x: number
}) {
  const theme = useTheme()
  const pos = labelPosition(trackLabels, trackLabelOffset, x)
  return trackLabels !== 'none' ? (
    <text
      x={pos.x}
      y={pos.y}
      textAnchor={pos.textAnchor}
      fontSize={fontSize}
      dominantBaseline="hanging"
      fill={stripAlpha(theme.palette.text.primary)}
    >
      {trackName}
    </text>
  ) : null
}
