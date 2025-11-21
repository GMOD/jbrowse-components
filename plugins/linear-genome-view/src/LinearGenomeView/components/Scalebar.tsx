import type React from 'react'
import { forwardRef } from 'react'

import { Paper } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import Gridlines from './Gridlines'
import ScalebarCoordinateLabels from './ScalebarCoordinateLabels'
import ScalebarRefNameLabels from './ScalebarRefNameLabels'

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

// Separate observer component for offsetPx changes to minimize re-renders
const ScalebarPositionedContent = observer(function ScalebarPositionedContent({
  model,
  style,
}: {
  model: LGV
  style?: React.CSSProperties
}) {
  const { classes } = useStyles()
  const { staticBlocks, offsetPx } = model
  const offsetLeft = staticBlocks.offsetPx - offsetPx

  return (
    <div
      className={classes.scalebar}
      style={{
        left: offsetLeft - 1,
        width: staticBlocks.totalWidthPx,
        ...style,
      }}
    >
      <ScalebarCoordinateLabels model={model} />
    </div>
  )
})

const Scalebar = observer(
  forwardRef<HTMLDivElement, ScalebarProps>(function Scalebar2(
    { model, style, className, ...other },
    ref,
  ) {
    const { classes, cx } = useStyles()
    const { scaleFactor } = model

    return (
      <Paper
        data-resizer="true" // used to avoid click-and-drag scrolls on trackscontainer
        className={cx(classes.container, className)}
        variant="outlined"
        ref={ref}
        style={style}
        {...other}
      >
        {/* offset 1px since for left track border */}
        <Gridlines model={model} offset={1} />
        <div
          className={classes.zoomContainer}
          style={{
            transform: scaleFactor !== 1 ? `scaleX(${scaleFactor})` : undefined,
          }}
        >
          <ScalebarPositionedContent model={model} style={style} />
        </div>
        <ScalebarRefNameLabels model={model} />
      </Paper>
    )
  }),
)

export default Scalebar
