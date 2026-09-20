import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { VERTICAL_SCROLLBAR_CLEARANCE } from '@jbrowse/core/ui/VerticalScrollbar'

import { axisCaptionY, axisGutterLeft } from './axisPlacement.ts'
import { AXIS_GUTTER_WIDTH_PX } from './yScaleTicks.ts'

import type { YAxis } from './valueScale.ts'

// Half the rotated caption's own 10px height plus a px of margin: how far in
// from the gutter's outer edge it sits with its glyphs still inside.
const CAPTION_INSET_PX = 8

/**
 * A scale's caption, drawn once however many bands the scale rules: rotated
 * along the outer edge of the gutter column, the origin at the column's top
 * left, centred on the bands given. The on-screen overlay and the export both
 * draw through this, so the two cannot place a caption differently.
 */
export default function AxisCaption({
  axis,
  bandTops,
}: {
  axis: YAxis
  bandTops: number[]
}) {
  const palette = usePalette()
  const x =
    axis.side === 'right'
      ? AXIS_GUTTER_WIDTH_PX - CAPTION_INSET_PX
      : CAPTION_INSET_PX
  const y = axisCaptionY(axis, bandTops)
  return (
    <text
      x={x}
      y={y}
      fontSize={10}
      textAnchor="middle"
      fill={palette.text.primary}
      stroke={palette.background.default}
      strokeWidth={2.5}
      paintOrder="stroke"
      transform={`rotate(-90, ${x}, ${y})`}
    >
      {axis.caption}
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
        width: AXIS_GUTTER_WIDTH_PX,
      }}
    >
      <AxisCaption axis={axis} bandTops={bandTops} />
    </svg>
  )
}
