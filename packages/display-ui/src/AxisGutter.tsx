import YScaleBar from './YScaleBar.tsx'
import { AXIS_GUTTER_WIDTH_PX } from './yScaleTicks.ts'

import type { YAxis } from './valueScale.ts'

/**
 * One band's axis drawn inside its gutter, the origin at the gutter's left
 * edge: the spine on the gutter's inner edge — its right for a left-side
 * axis, its left for a right-side one — with the numbers growing outward. The
 * on-screen overlay and the export both draw through this, so the two cannot
 * place a spine differently. The scale's caption is `AxisCaption`'s, drawn once
 * for the scale and not per band.
 */
export default function AxisGutter({ axis }: { axis: YAxis }) {
  const right = axis.side === 'right'
  return (
    <g transform={`translate(${right ? 0 : AXIS_GUTTER_WIDTH_PX} 0)`}>
      <YScaleBar
        ticks={axis.ticks}
        orientation={right ? 'right' : 'left'}
        bandHeight={axis.height}
      />
    </g>
  )
}
