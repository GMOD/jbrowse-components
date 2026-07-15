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

// Shared zoom-transform wrapper for the gridline ticks and padding-block
// overlays. Re-renders on zoom or region change, not on per-frame offsetPx
// changes — those move the outer transform only.
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
