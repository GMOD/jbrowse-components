import type React from 'react'
import { forwardRef, useEffect, useRef } from 'react'

import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { Paper } from '@mui/material'
import { autorun } from 'mobx'

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

const Scalebar = forwardRef<HTMLDivElement, ScalebarProps>(function Scalebar2(
  { model, style, className, ...other },
  ref,
) {
  const { classes } = useStyles()
  const zoomRef = useRef<HTMLDivElement>(null)
  const scalebarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return autorun(
      function scalebarZoomAutorun() {
        const { scaleFactor } = model
        const zoom = zoomRef.current
        if (zoom) {
          zoom.style.transform =
            scaleFactor !== 1 ? `scaleX(${scaleFactor})` : ''
        }
      },
      { name: 'ScalebarZoom' },
    )
  }, [model])

  useEffect(() => {
    return autorun(
      function scalebarTransformAutorun() {
        const { staticBlocks, offsetPx } = model
        const scalebar = scalebarRef.current
        if (scalebar) {
          const offsetLeft = Math.round(staticBlocks.offsetPx - offsetPx)
          scalebar.style.transform = `translateX(${offsetLeft - 1}px)`
          scalebar.style.width = `${staticBlocks.totalWidthPx}px`
        }
      },
      { name: 'ScalebarTransform' },
    )
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
      {/* offset 1px for left track border */}
      <Gridlines model={model} offset={1} />
      <div ref={zoomRef} className={classes.zoomContainer}>
        <div ref={scalebarRef} className={classes.scalebar}>
          <ScalebarCoordinateLabels model={model} />
        </div>
      </div>
      <ScalebarRefNameLabels model={model} />
    </Paper>
  )
})

export default Scalebar
