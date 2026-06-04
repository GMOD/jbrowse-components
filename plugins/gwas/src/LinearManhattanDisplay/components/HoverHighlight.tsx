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
}: {
  screenX: number
  screenY: number
  width: number
  height: number
}) {
  const { classes } = useStyles()
  return (
    <svg
      className={classes.svg}
      width={width}
      height={height - 2 * YSCALEBAR_LABEL_OFFSET}
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
