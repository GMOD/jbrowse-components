import { useEffect, useRef, useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getPreparedCanvas2D } from '@jbrowse/render-core/canvas2dUtils'
import { autorun, untracked } from 'mobx'
import { observer } from 'mobx-react'

import { paintShapes } from './chordLayer.ts'

import type { CircularViewModel } from '../CircularView/model.ts'
import type { ChordPicker } from './chordLayer.ts'

const useStyles = makeStyles()({
  canvas: {
    position: 'absolute',
    left: 0,
    top: 0,
    pointerEvents: 'none',
  },
})

// how long a rotation runs on the CSS transform before the canvas repaints
// under it
const ROTATION_REPAINT_DELAY_MS = 150

/**
 * The resting chords and ribbons, painted once per change onto a canvas the
 * size of the view's box and turned with the figure. A rotation is the one
 * change that arrives per frame, so it turns the painted canvas by CSS until
 * the drag pauses and repaints with the rotation baked in; the ruler and the
 * highlight paths turn on the SVG above and the rings on their own canvas, so
 * nothing on the figure slips out of step.
 */
const ChordCanvas = observer(function ChordCanvas({
  view,
  picker,
}: {
  view: CircularViewModel
  picker: ChordPicker
}) {
  const { classes } = useStyles()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [painted, setPainted] = useState(view.offsetRadians)
  const { width, height, offsetRadians, figureOriginXY, centerXY } = view
  const centerX = figureOriginXY[0] + centerXY[0]
  const centerY = figureOriginXY[1] + centerXY[1]

  useEffect(() => {
    const paint = (rotation: number) => {
      const { chordDisplays, width, height, figureSize } = view
      const [ox, oy] = view.figureOriginXY
      const [cx, cy] = view.centerXY
      const ctx = getPreparedCanvas2D(canvasRef.current, width, height)
      if (ctx) {
        ctx.translate(ox + cx, oy + cy)
        ctx.rotate(rotation)
        for (const display of chordDisplays) {
          paintShapes(ctx, display)
        }
      }
      picker.update(chordDisplays, figureSize)
      setPainted(rotation)
    }
    // The rotation only goes into the paint; the delayed autorun below keys a
    // repaint on it, so the canvas turns by CSS per frame rather than
    // repainting per frame
    const disposePaint = autorun(() => {
      // eslint-disable-next-line no-restricted-syntax -- EFFECT INPUT
      paint(untracked(() => view.offsetRadians))
    })
    const disposeRotate = autorun(
      () => {
        const rotation = view.offsetRadians
        // eslint-disable-next-line no-restricted-syntax -- EFFECT INPUT
        untracked(() => {
          paint(rotation)
        })
      },
      { delay: ROTATION_REPAINT_DELAY_MS },
    )
    return () => {
      disposePaint()
      disposeRotate()
    }
  }, [view, picker])

  return (
    <canvas
      ref={canvasRef}
      className={classes.canvas}
      data-testid="circular-chord-canvas"
      style={{
        width,
        height,
        transform: `rotate(${offsetRadians - painted}rad)`,
        transformOrigin: `${centerX}px ${centerY}px`,
      }}
    />
  )
})

export default ChordCanvas
