import React from 'react'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
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
    zIndex: 1,
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

const Scalebar = observer(
  React.forwardRef<HTMLDivElement, ScalebarProps>(function Scalebar2(
    { model, style, className, ...other },
    ref,
  ) {
    const { classes, cx } = useStyles()
    const { staticBlocks, offsetPx, scaleFactor } = model
    const offsetLeft = staticBlocks.offsetPx - offsetPx
    return (
      <Paper
        data-resizer="true" // used to avoid click-and-drag scrolls on trackscontainer
        className={cx(classes.container, className)}
        variant="outlined"
        ref={ref}
        style={style}
        {...other}
      >
        <div
          className={classes.zoomContainer}
          style={{
            transform: scaleFactor !== 1 ? `scaleX(${scaleFactor})` : undefined,
          }}
        >
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
        </div>
        <ScalebarRefNameLabels model={model} />
      </Paper>
    )
  }),
)

export default Scalebar
