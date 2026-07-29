import YScaleBar from './YScaleBar.tsx'
import { ONSCREEN_AXIS_LEFT_PX } from './constants.ts'

import type { YScaleTicks } from './index.ts'

// Y-axis tick labels positioned absolutely, indented from the track's left edge
// so a right-oriented axis reads inside the plot. The SVG export instead anchors
// a left-oriented axis at the content edge, putting the labels in the export
// margin — see WiggleFamilySvgFrame.
export default function YScaleBarOverlay({
  ticks,
  height,
}: {
  ticks: YScaleTicks
  height: number
}) {
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: ONSCREEN_AXIS_LEFT_PX,
        pointerEvents: 'none',
        height,
        width: 70,
      }}
    >
      <YScaleBar ticks={ticks} orientation="right" />
    </svg>
  )
}
