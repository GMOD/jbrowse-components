import { useEffect, useRef } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getDpr } from '@jbrowse/render-core/canvas2dUtils'
import { useTheme } from '@mui/material'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  absoluteFill: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
})

// Background gridline ticks, drawn under track content into one viewport-sized
// canvas per call site. Pan and zoom redraw it from an autorun, so no React
// commit and no DOM overlay repaint happens per frame.
const Gridlines = observer(function Gridlines({
  model,
  offset = 0,
}: {
  model: LGV
  offset?: number
}) {
  const { classes } = useStyles()
  const theme = useTheme()
  const minorColor = theme.palette.gridlineMinor
  const majorColor = theme.palette.gridlineMajor
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      const draw = () => {
        const { gridlineTicks, staticBlocksTranslateX } = model
        const dpr = getDpr()
        const cssWidth = canvas.clientWidth
        const cssHeight = canvas.clientHeight
        const width = Math.round(cssWidth * dpr)
        const height = Math.round(cssHeight * dpr)
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width
          canvas.height = height
        }
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          ctx.clearRect(0, 0, cssWidth, cssHeight)
          const shift = staticBlocksTranslateX - offset
          for (const pass of [false, true]) {
            ctx.fillStyle = pass ? majorColor : minorColor
            for (const { x, major } of gridlineTicks) {
              const px = Math.floor(x + shift)
              if (major === pass && px >= 0 && px < cssWidth) {
                ctx.fillRect(px, 0, 1, cssHeight)
              }
            }
          }
        }
      }
      const disposer = autorun(draw)
      const observer = new ResizeObserver(() => {
        draw()
      })
      observer.observe(canvas)
      return () => {
        disposer()
        observer.disconnect()
      }
    }
    return undefined
  }, [model, offset, minorColor, majorColor])

  return <canvas ref={canvasRef} className={classes.absoluteFill} />
})

export default Gridlines
