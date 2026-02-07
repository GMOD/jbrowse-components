import type React from 'react'

import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import Gridlines from './Gridlines.tsx'
import ScalebarCoordinateLabels from './ScalebarCoordinateLabels.tsx'
import ScalebarRefNameLabels from './ScalebarRefNameLabels.tsx'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  scalebar: {
    position: 'absolute',
    display: 'flex',
    pointerEvents: 'none',
  },
})

interface ScalebarProps {
  model: LGV
  style?: React.CSSProperties
  className?: string
}

// Thin wrapper that re-renders on scroll to update the transform.
// Children (ScalebarCoordinateLabels, ScalebarRefNameLabels) are separate
// observers that only re-render when their own tracked observables change.
const Scalebar = observer(function Scalebar({
  model,
  style,
  className,
  ...other
}: ScalebarProps) {
  const { classes } = useStyles()
  const { staticBlocks, offsetPx } = model
  const offsetLeft = Math.round(staticBlocks.offsetPx - offsetPx)
  // console.log('[Scalebar] render', {
  //   numBlocks: staticBlocks.blocks.length,
  //   totalWidthPx: staticBlocks.totalWidthPx,
  // })

  return (
    <Paper
      data-resizer="true" // used to avoid click-and-drag scrolls on trackscontainer
      className={cx(classes.container, className)}
      variant="outlined"
      style={style}
      {...other}
    >
      {/* offset 1px for left track border */}
      <Gridlines model={model} offset={1} />
      <div
        className={classes.scalebar}
        style={{
          transform: `translateX(${offsetLeft - 1}px)`,
          width: staticBlocks.totalWidthPx,
        }}
      >
        <ScalebarCoordinateLabels model={model} />
      </div>
      <ScalebarRefNameLabels model={model} />
    </Paper>
  )
})

export default Scalebar
