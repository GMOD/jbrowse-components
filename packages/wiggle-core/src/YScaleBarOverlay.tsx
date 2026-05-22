import YScaleBar from './YScaleBar.tsx'

import type { YScaleTicks } from './index.ts'

// Y-axis tick labels positioned absolutely. `scalebarLeft` tracks the left
// edge of visible track content (non-zero only when track labels overlap or
// the view is scrolled before the genome start); falls back to 50px when 0
// so the labels stay readable in the default layout.
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
