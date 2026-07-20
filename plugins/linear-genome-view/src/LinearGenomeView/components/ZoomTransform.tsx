import type { ReactNode } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  zoomContainer: {
    position: 'absolute',
    top: 0,
    height: '100%',
    width: '100%',
    pointerEvents: 'none',
  },
  innerContainer: {
    position: 'absolute',
    height: '100%',
    pointerEvents: 'none',
  },
})

// Shared zoom/scroll-transform wrapper for the gridline ticks and padding-block
// overlays. Lays the overlay out in the staticBlocks frame and shifts it into
// the viewport by staticBlocks.offsetPx - offsetPx, so it tracks scroll — but a
// re-render only patches this div's transform plus the child's path `d`
// strings, so it stays cheap per frame.
const ZoomTransform = observer(function ZoomTransform({
  model,
  offset = 0,
  children,
}: {
  model: LGV
  offset?: number
  children: ReactNode
}) {
  const { classes } = useStyles()
  const { staticBlocks, offsetPx } = model
  return (
    <div className={classes.zoomContainer}>
      <div
        className={classes.innerContainer}
        style={{
          transform: `translateX(${staticBlocks.offsetPx - offsetPx - offset}px)`,
          width: staticBlocks.totalWidthPx,
        }}
      >
        {children}
      </div>
    </div>
  )
})

export default ZoomTransform
