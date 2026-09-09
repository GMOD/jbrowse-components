import { VERTICAL_SCROLLBAR_CLEARANCE } from '@jbrowse/core/ui/VerticalScrollbar'

import AxisGutter from './AxisGutter.tsx'
import { axisGutterLeft } from './axisPlacement.ts'
import { AXIS_GUTTER_WIDTH_PX } from './yScaleTicks.ts'

import type { YAxis } from './valueScale.ts'

/**
 * The on-screen axis of one band: an `<svg>` the width of the gutter,
 * positioned absolutely over the band at `top`, with `AxisGutter` inside. A
 * right-side gutter clears the vertical scrollbar a display may mount.
 */
export default function YScaleBarOverlay({
  axis,
  top,
  width,
}: {
  axis: YAxis
  top: number
  width: number
}) {
  return (
    <svg
      style={{
        position: 'absolute',
        top,
        left: axisGutterLeft(axis, width, VERTICAL_SCROLLBAR_CLEARANCE),
        pointerEvents: 'none',
        height: axis.height,
        width: AXIS_GUTTER_WIDTH_PX,
        overflow: 'visible',
      }}
    >
      <AxisGutter axis={axis} />
    </svg>
  )
}
