import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { VERTICAL_SCROLLBAR_CLEARANCE } from '@jbrowse/core/ui/VerticalScrollbar'
import { measureText } from '@jbrowse/core/util/measureText'

import {
  axisCaptionY,
  axisGutterLeft,
  axisGutterWidth,
} from './axisPlacement.ts'
import { AXIS_FONT_PX, CAPTION_INSET_PX } from './yAxisConstants.ts'

import type { YAxis } from './valueScale.ts'

// The caption and its length, cut to an ellipsis where it is longer than
// `room`, as a Vega-Lite axis title is cut at its `titleLimit`. The ellipsis
// is one em.
function fitCaption(caption: string, room: number) {
  const whole = measureText(caption, AXIS_FONT_PX)
  if (whole <= room) {
    return { text: caption, length: whole }
  }
  for (let end = caption.length - 1; end > 0; end--) {
    const length =
      measureText(caption.slice(0, end), AXIS_FONT_PX) + AXIS_FONT_PX
    if (length <= room) {
      return { text: `${caption.slice(0, end)}…`, length }
    }
  }
  return undefined
}

/**
 * A scale's caption, drawn once however many bands the scale rules: rotated
 * along the outer edge of the gutter column, the origin at the column's top
 * left, centred on the bands given as nearly as the display's `height` holds
 * it whole, and cut to that height where it is longer. The on-screen overlay
 * and the export both draw through this, so the two cannot place a caption
 * differently.
 */
export default function AxisCaption({
  axis,
  bandTops,
  height,
}: {
  axis: YAxis
  bandTops: number[]
  height: number
}) {
  const palette = usePalette()
  const x =
    axis.side === 'right'
      ? axisGutterWidth(axis) - CAPTION_INSET_PX
      : CAPTION_INSET_PX
  const caption = fitCaption(axis.caption ?? '', height)
  if (!caption) {
    return null
  }
  const half = caption.length / 2
  const y = Math.min(
    Math.max(axisCaptionY(axis, bandTops), half),
    height - half,
  )
  return (
    <text
      x={x}
      y={y}
      fontSize={AXIS_FONT_PX}
      textAnchor="middle"
      fill={palette.text.primary}
      stroke={palette.background.default}
      strokeWidth={2.5}
      paintOrder="stroke"
      transform={`rotate(-90, ${x}, ${y})`}
    >
      {caption.text}
    </text>
  )
}

/**
 * The on-screen caption of one scale: an `<svg>` over the gutter column, the
 * height of the display, with `AxisCaption` inside.
 */
export function AxisCaptionOverlay({
  axis,
  bandTops,
  width,
  height,
}: {
  axis: YAxis
  bandTops: number[]
  width: number
  height: number
}) {
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: axisGutterLeft(axis, width, VERTICAL_SCROLLBAR_CLEARANCE),
        pointerEvents: 'none',
        height,
        width: axisGutterWidth(axis),
      }}
    >
      <AxisCaption axis={axis} bandTops={bandTops} height={height} />
    </svg>
  )
}
