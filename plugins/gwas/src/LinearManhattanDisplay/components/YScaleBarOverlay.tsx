import { YScaleBar } from '@jbrowse/wiggle-core'

import type { YScaleTicks } from '@jbrowse/wiggle-core'

// Y-axis tick labels, pinned to a position that follows the left edge of
// visible track content (scalebarOverlapLeft).
export default function YScaleBarOverlay({
  ticks,
  height,
  scalebarLeft,
}: {
  ticks: YScaleTicks
  height: number
  scalebarLeft: number
}) {
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: scalebarLeft || 50,
        pointerEvents: 'none',
        height,
        width: 70,
      }}
    >
      <YScaleBar ticks={ticks} orientation="right" />
    </svg>
  )
}
