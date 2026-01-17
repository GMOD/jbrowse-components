import type React from 'react'

import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import Gridlines from './Gridlines.tsx'
import ScalebarCoordinateLabels from './ScalebarCoordinateLabels.tsx'
import ScalebarRefNameLabels from './ScalebarRefNameLabels.tsx'

import type { LinearGenomeViewModel } from '..'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  zoomContainer: {
    position: 'relative',
  },
  // Scalebar positioned using CSS calc() with --offset-px variable
  // Uses translateX for smooth positioning (subpixel gaps less visible here)
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

const Scalebar = observer(function Scalebar({
  model,
  style,
  className,
  ...other
}: ScalebarProps) {
  const { classes } = useStyles()
  const { scaleFactor, staticBlocks, offsetPx } = model

  return (
    <Paper
      data-resizer="true" // used to avoid click-and-drag scrolls on trackscontainer
      className={cx(classes.container, className)}
      variant="outlined"
      style={
        { ...style, '--offset-px': `${offsetPx}px` } as React.CSSProperties
      }
      {...other}
    >
      {/* offset 1px for left track border */}
      <Gridlines model={model} offset={1} />
      <div
        className={classes.zoomContainer}
        style={{
          transform: scaleFactor !== 1 ? `scaleX(${scaleFactor})` : undefined,
        }}
      >
        <div
          className={classes.scalebar}
          style={{
            transform: `translateX(calc(${staticBlocks.offsetPx}px - var(--offset-px) - 1px))`,
            width: staticBlocks.totalWidthPx,
          }}
        >
          <ScalebarCoordinateLabels model={model} />
        </div>
      </div>
      <ScalebarRefNameLabels model={model} />
    </Paper>
  )
})

export default Scalebar
