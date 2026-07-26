import { stripAlpha } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import {
  TRACK_LABEL_GAP,
  insetLabelBaselineY,
  offsetLabelBaselineY,
} from './util.ts'

import type { TrackLabelMode } from '../types.ts'

// Where the label sits, per mode. 'left' right-aligns in the gutter
// trackLabelLeftOffset reserved (hence the shared TRACK_LABEL_GAP); the other
// modes hang off the leftmost visible content at `x`, either just above the
// track body ('offset') or inset over it ('overlay').
//
// 'offset' is placed on its alphabetic baseline (not a hanging one) so its
// descenders land a known distance above the track body — the band it sits in
// is `textHeight` tall, and offsetLabelBaselineY owns that arithmetic.
function labelPosition({
  trackLabels,
  trackLabelOffset,
  textHeight,
  fontSize,
  x,
}: {
  trackLabels: TrackLabelMode
  trackLabelOffset: number
  textHeight: number
  fontSize: number
  x: number
}) {
  return trackLabels === 'left'
    ? {
        x: trackLabelOffset - TRACK_LABEL_GAP,
        y: 20,
        textAnchor: 'end' as const,
        dominantBaseline: 'hanging' as const,
      }
    : trackLabels === 'offset'
      ? {
          x,
          y: offsetLabelBaselineY(textHeight, fontSize),
          // left-aligned on the alphabetic baseline is the SVG default; omit
          // both rather than spend bytes on them
          textAnchor: undefined,
          dominantBaseline: undefined,
        }
      : {
          // inset over the track body, on a baseline far enough down that the
          // ascenders stay inside it (at y=0 they rose into the track above)
          x: x + 5,
          y: insetLabelBaselineY(fontSize),
          textAnchor: undefined,
          dominantBaseline: undefined,
        }
}

export default function SVGTrackLabel({
  trackLabels,
  trackName,
  fontSize,
  textHeight,
  trackLabelOffset,
  x,
}: {
  // already run through svgTrackName (HTML stripped)
  trackName: string
  trackLabels: TrackLabelMode
  fontSize: number
  textHeight: number
  trackLabelOffset: number
  x: number
}) {
  const theme = useTheme()
  const pos = labelPosition({
    trackLabels,
    trackLabelOffset,
    textHeight,
    fontSize,
    x,
  })
  return trackLabels !== 'none' ? (
    <text
      x={pos.x}
      y={pos.y}
      textAnchor={pos.textAnchor}
      fontSize={fontSize}
      dominantBaseline={pos.dominantBaseline}
      fill={stripAlpha(theme.palette.text.primary)}
    >
      {trackName}
    </text>
  ) : null
}
