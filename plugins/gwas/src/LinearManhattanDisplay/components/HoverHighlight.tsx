import { makeStyles } from '@jbrowse/core/util/tss-react'
import { axisPlotBox } from '@jbrowse/wiggle-core'

const useStyles = makeStyles()({
  svg: {
    position: 'absolute',
    left: 0,
    pointerEvents: 'none',
  },
})

// Black ring around the hovered point. Drawn in an SVG overlay so it can sit
// above the canvas without disturbing GPU re-renders.
//
// Both ends of its box come off `axisPlotBox`, the same call that positions the
// canvas beneath it: the ring is drawn at a `screenY` measured in that canvas'
// space, so respelling either end here is what would drift it.
export default function HoverHighlight({
  screenX,
  screenY,
  width,
  height,
  pointDiameterPx,
}: {
  screenX: number
  screenY: number
  width: number
  height: number
  pointDiameterPx: number
}) {
  const { classes } = useStyles()
  const { yTop, plotHeight } = axisPlotBox(height)
  // Ring sits just outside the point with a fixed margin; the floor keeps it
  // visible/grabbable for tiny points and reproduces the historical r=6 at the
  // default 4px diameter.
  const r = Math.max(6, pointDiameterPx / 2 + 4)
  return (
    <svg
      className={classes.svg}
      style={{ top: yTop }}
      width={width}
      height={plotHeight}
    >
      <circle
        cx={screenX}
        cy={screenY}
        r={r}
        fill="none"
        stroke="black"
        strokeWidth={1.5}
      />
    </svg>
  )
}
