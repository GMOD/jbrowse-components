import YScaleBar from './YScaleBar.tsx'
import { axisGutterWidth, numbersGrowRight } from './axisPlacement.ts'

import type { YAxis } from './valueScale.ts'

/**
 * One band's axis drawn inside its gutter, the origin at the gutter's left
 * edge: the spine on the gutter's left edge with the numbers growing right
 * where `numbersGrowRight` says so, and on its right edge otherwise. The
 * on-screen overlay and the export both draw through this, so the two cannot
 * place a spine differently. The scale's caption is `AxisCaption`'s, drawn once
 * for the scale and not per band.
 */
// eslint-disable-next-line no-restricted-syntax -- drawn inside a frozen SVG figure
export default function AxisGutter({ axis }: { axis: YAxis }) {
  const right = numbersGrowRight(axis)
  return (
    <g transform={`translate(${right ? 0 : axisGutterWidth(axis)} 0)`}>
      <YScaleBar
        ticks={axis.ticks}
        orientation={right ? 'right' : 'left'}
        bandHeight={axis.height}
      />
    </g>
  )
}
