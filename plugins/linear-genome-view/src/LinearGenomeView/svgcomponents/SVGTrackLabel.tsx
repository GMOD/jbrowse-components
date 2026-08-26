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
// Every mode is placed on its alphabetic baseline (the SVG default, so no
// dominantBaseline is emitted at all): 'offset' so its descenders land a known
// distance above the track body — the band it sits in is `textHeight` tall, and
// offsetLabelBaselineY owns that arithmetic — and 'left'/'overlay' so their
// ascenders stay inside the track box they align with. 'left' used to be pinned
// at a hardcoded y=20 on a hanging baseline, which neither scaled with fontSize
// nor stayed inside a track shorter than ~35px.
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
}): { x: number; y: number; textAnchor?: 'end' } {
  if (trackLabels === 'left') {
    return {
      x: trackLabelOffset - TRACK_LABEL_GAP,
      y: insetLabelBaselineY(fontSize),
      textAnchor: 'end',
    }
  }
  // the other two are left-aligned, which is the SVG default, so neither emits
  // a textAnchor at all
  if (trackLabels === 'offset') {
    return { x, y: offsetLabelBaselineY(textHeight, fontSize) }
  }
  // inset over the track body, on a baseline far enough down that the ascenders
  // stay inside it (at y=0 they rose into the track above)
  return { x: x + 5, y: insetLabelBaselineY(fontSize) }
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
  if (trackLabels === 'none') {
    return null
  }
  const pos = labelPosition({
    trackLabels,
    trackLabelOffset,
    textHeight,
    fontSize,
    x,
  })
  return (
    <text
      x={pos.x}
      y={pos.y}
      textAnchor={pos.textAnchor}
      fontSize={fontSize}
      fill={stripAlpha(theme.palette.text.primary)}
    >
      {trackName}
    </text>
  )
}
