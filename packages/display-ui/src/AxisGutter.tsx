import { usePalette } from '@jbrowse/core/ui/PaletteContext'

import YScaleBar from './YScaleBar.tsx'
import { AXIS_GUTTER_WIDTH_PX } from './yScaleTicks.ts'

import type { YAxis } from './valueScale.ts'

// Half the rotated caption's own 10px height plus a px of margin: how far in
// from the gutter's outer edge it sits with its glyphs still inside.
const CAPTION_INSET_PX = 8

/**
 * One band's axis drawn inside its gutter, the origin at the gutter's left
 * edge: the spine on the gutter's inner edge — its right for a left-side
 * axis, its left for a right-side one — with the numbers growing outward, and
 * the caption, where the scale has one, rotated along the outer edge. The
 * on-screen overlay and the export both draw through this, so the two cannot
 * place a spine differently.
 */
export default function AxisGutter({ axis }: { axis: YAxis }) {
  const palette = usePalette()
  const right = axis.side === 'right'
  const { ticks, caption, height } = axis
  const captionX = right
    ? AXIS_GUTTER_WIDTH_PX - CAPTION_INSET_PX
    : CAPTION_INSET_PX
  const midY = (ticks.yTop + ticks.yBottom) / 2
  return (
    <>
      <g transform={`translate(${right ? 0 : AXIS_GUTTER_WIDTH_PX} 0)`}>
        <YScaleBar
          ticks={ticks}
          orientation={right ? 'right' : 'left'}
          bandHeight={height}
        />
      </g>
      {caption ? (
        <text
          x={captionX}
          y={midY}
          fontSize={10}
          textAnchor="middle"
          fill={palette.text.primary}
          stroke={palette.background.default}
          strokeWidth={2.5}
          paintOrder="stroke"
          transform={`rotate(-90, ${captionX}, ${midY})`}
        >
          {caption}
        </text>
      ) : null}
    </>
  )
}
