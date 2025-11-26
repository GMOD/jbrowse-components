import type React from 'react'
import { forwardRef, useEffect, useRef } from 'react'

import { Paper } from '@mui/material'
import { autorun } from 'mobx'
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

function ScalebarPositionedContent({ model }: { model: LGV }) {
  const { classes } = useStyles()
  const scalebarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return autorun(() => {
      const { staticBlocks, offsetPx } = model
      const scalebar = scalebarRef.current
      if (scalebar) {
        const offsetLeft = staticBlocks.offsetPx - offsetPx
        scalebar.style.transform = `translateX(${offsetLeft - 1}px)`
        scalebar.style.width = `${staticBlocks.totalWidthPx}px`
      }
    })
  }, [model])

  return (
    <div ref={scalebarRef} className={classes.scalebar}>
      <ScalebarCoordinateLabels model={model} />
    </div>
  )
}

const Scalebar = forwardRef<HTMLDivElement, ScalebarProps>(function Scalebar2(
  { model, style, className, ...other },
  ref,
) {
  const { classes, cx } = useStyles()
  const zoomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return autorun(() => {
      const { scaleFactor } = model
      const zoom = zoomRef.current
      if (zoom) {
        zoom.style.transform = scaleFactor !== 1 ? `scaleX(${scaleFactor})` : ''
      }
    })
  }, [model])

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
      <div ref={zoomRef} className={classes.zoomContainer}>
        <ScalebarPositionedContent model={model} />
      </div>
      <ScalebarRefNameLabels model={model} />
    </Paper>
  )
})

export default Scalebar
