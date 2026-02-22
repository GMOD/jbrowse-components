import type React from 'react'
import { useEffect, useRef } from 'react'

import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { Paper } from '@mui/material'
import { autorun } from 'mobx'

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

export default function Scalebar({
  model,
  style,
  className,
  ...other
}: ScalebarProps) {
  const { classes } = useStyles()
  const scalebarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return autorun(() => {
      const el = scalebarRef.current
      if (!el) {
        return
      }
      const { staticBlocks, offsetPx } = model
      const offsetLeft = Math.round(staticBlocks.offsetPx - offsetPx)
      el.style.transform = `translateX(${offsetLeft - 1}px)`
      el.style.width = `${staticBlocks.totalWidthPx}px`
    })
  }, [model])

  return (
    <Paper
      data-resizer="true"
      className={cx(classes.container, className)}
      variant="outlined"
      style={style}
      {...other}
    >
      <Gridlines model={model} offset={1} />
      <div ref={scalebarRef} className={classes.scalebar}>
        <ScalebarCoordinateLabels model={model} />
      </div>
      <ScalebarRefNameLabels model={model} />
    </Paper>
  )
}
