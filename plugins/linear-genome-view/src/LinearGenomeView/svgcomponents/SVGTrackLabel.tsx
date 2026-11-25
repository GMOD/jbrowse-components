import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { stripAlpha } from '@jbrowse/core/util'
import { SvgHaloText } from '@jbrowse/display-ui'

import {
  TRACK_LABEL_GAP,
  insetLabelBaselineY,
  offsetLabelBaselineY,
} from './util.ts'

import type { TrackLabelMode } from '../types.ts'

// Where the label sits, per mode. 'left' right-aligns in the gutter
// trackLabelLeftOffset reserved (hence the shared TRACK_LABEL_GAP), beside the
// first row and clear of the y axis left of the body. The other modes hang off the leftmost visible content
// at `x`, either just above the track body ('offset') or inset over it
// ('overlapping').
//
// Every mode is placed on its alphabetic baseline (the SVG default, so no
// dominantBaseline is emitted at all): 'offset' so its descenders land a known distance above the track body — the band is
// `textHeight` tall, and offsetLabelBaselineY owns that arithmetic — and
// 'left'/'overlapping' so their ascenders stay inside the track box they align
// with.
function labelPosition({
  trackLabels,
  trackLabelOffset,
  leftAxisWidth,
  textHeight,
  fontSize,
  x,
}: {
  trackLabels: TrackLabelMode
  trackLabelOffset: number
  leftAxisWidth: number
  textHeight: number
  fontSize: number
  x: number
}): { x: number; y: number; textAnchor?: 'end' } {
  if (trackLabels === 'left') {
    return {
      x: trackLabelOffset - leftAxisWidth - TRACK_LABEL_GAP,
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
  leftAxisWidth,
  x,
}: {
  // already run through svgTrackName (HTML stripped)
  trackName: string
  trackLabels: TrackLabelMode
  fontSize: number
  textHeight: number
  trackLabelOffset: number
  leftAxisWidth: number
  x: number
}) {
  const palette = usePalette()
  if (trackLabels === 'hidden') {
    return null
  }
  const pos = labelPosition({
    trackLabels,
    trackLabelOffset,
    leftAxisWidth,
    textHeight,
    fontSize,
    x,
  })
  const fill = stripAlpha(palette.text.primary)
  // 'overlapping' prints over the track's own data, which the on-screen label
  // clears with a paper box, so it carries the halo text over a plot needs
  return trackLabels === 'overlapping' ? (
    <SvgHaloText
      x={pos.x}
      y={pos.y}
      fontSize={fontSize}
      fill={fill}
      halo={stripAlpha(palette.background.paper)}
      haloWidth={3}
    >
      {trackName}
    </SvgHaloText>
  ) : (
    <text
      x={pos.x}
      y={pos.y}
      textAnchor={pos.textAnchor}
      fontSize={fontSize}
      fill={fill}
    >
      {trackName}
    </text>
  )
}
