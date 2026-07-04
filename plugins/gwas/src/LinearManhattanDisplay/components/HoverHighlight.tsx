import { makeStyles } from '@jbrowse/core/util/tss-react'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

const useStyles = makeStyles()({
  svg: {
    position: 'absolute',
    top: YSCALEBAR_LABEL_OFFSET,
    left: 0,
    pointerEvents: 'none',
  },
})

// Black ring around the hovered point. Drawn in an SVG overlay so it can sit
// above the canvas without disturbing GPU re-renders.
const HoverHighlight = observer(function HoverHighlight({
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
  // Ring sits just outside the point with a fixed margin; the floor keeps it
  // visible/grabbable for tiny points and reproduces the historical r=6 at the
  // default 4px diameter.
  const r = Math.max(6, pointDiameterPx / 2 + 4)
  return (
    <svg
      className={classes.svg}
      width={width}
      height={height - 2 * YSCALEBAR_LABEL_OFFSET}
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
})

export default HoverHighlight
