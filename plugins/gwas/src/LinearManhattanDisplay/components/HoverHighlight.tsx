import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

// Black ring around the hovered point. Drawn in an SVG overlay so it can sit
// above the canvas without disturbing GPU re-renders.
const HoverHighlight = observer(function HoverHighlight({
  screenX,
  screenY,
  width,
  height,
}: {
  screenX: number
  screenY: number
  width: number
  height: number
}) {
  return (
    <svg
      style={{
        position: 'absolute',
        top: YSCALEBAR_LABEL_OFFSET,
        left: 0,
        pointerEvents: 'none',
        width,
        height: height - 2 * YSCALEBAR_LABEL_OFFSET,
      }}
    >
      <circle
        cx={screenX}
        cy={screenY}
        r={6}
        fill="none"
        stroke="black"
        strokeWidth={1.5}
      />
    </svg>
  )
})

export default HoverHighlight
