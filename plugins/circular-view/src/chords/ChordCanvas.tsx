import { useEffect, useRef, useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getPreparedCanvas2D } from '@jbrowse/render-core/canvas2dUtils'
import { autorun, untracked } from 'mobx'
import { observer } from 'mobx-react'

import { paintShapes } from './chordLayer.ts'

import type { CircularViewModel } from '../CircularView/model.ts'
import type { ChordFrame, ChordPicker } from './chordLayer.ts'

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

/** Where the circle sits in the box now, as the canvas paints it. */
function frameOf(view: CircularViewModel, rotation: number): ChordFrame {
  const [ox, oy] = view.figureOriginXY
  const [cx, cy] = view.centerXY
  return {
    width: view.width,
    height: view.height,
    centerX: ox + cx,
    centerY: oy + cy,
    rotation,
  }
}

/**
 * Whether the whole figure lies inside the box, which is when turning the
 * painted canvas by CSS shows every chord where it belongs. A zoomed or panned
 * circle reaches past the box, and a turn would swing unpainted area in.
 */
function figureFitsBox(view: CircularViewModel) {
  const [ox, oy] = view.figureOriginXY
  const { figureSize, width, height } = view
  return (
    ox >= 0 && oy >= 0 && ox + figureSize <= width && oy + figureSize <= height
  )
}

/**
 * The resting chords and ribbons, painted once per change onto a canvas the
 * size of the view's box and turned with the figure. A rotation is the one
 * change that arrives per frame: while the figure fits the box, the painted
 * canvas turns by CSS until the rotation pauses and repaints with it baked
 * in; past the box it repaints per animation frame instead. The ruler and the
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
      const { chordDisplays } = view
      const frame = frameOf(view, rotation)
      const canvas = canvasRef.current
      const ctx = getPreparedCanvas2D(canvas, frame.width, frame.height)
      if (ctx) {
        ctx.translate(frame.centerX, frame.centerY)
        ctx.rotate(rotation)
        for (const display of chordDisplays) {
          paintShapes(ctx, display)
        }
      }
      picker.update(chordDisplays, frame)
      // written here as well as through state, so the frame between this
      // paint and React's render does not turn the fresh bitmap twice
      if (canvas) {
        canvas.style.transform = 'rotate(0rad)'
      }
      setPainted(rotation)
    }
    // The rotation only goes into the paint; the autorun below keys a repaint
    // on it, so the canvas turns by CSS per frame rather than repainting
    const disposePaint = autorun(() => {
      // eslint-disable-next-line no-restricted-syntax -- EFFECT INPUT
      paint(untracked(() => view.offsetRadians))
    })
    let timer: ReturnType<typeof setTimeout> | undefined
    let frame: number | undefined
    let first = true
    const disposeRotate = autorun(() => {
      const rotation = view.offsetRadians
      const fits = figureFitsBox(view)
      if (first) {
        first = false
        return
      }
      clearTimeout(timer)
      if (fits) {
        timer = setTimeout(() => {
          // eslint-disable-next-line no-restricted-syntax -- EFFECT INPUT
          untracked(() => {
            paint(rotation)
          })
        }, ROTATION_REPAINT_DELAY_MS)
      } else if (frame === undefined) {
        frame = requestAnimationFrame(() => {
          frame = undefined
          // eslint-disable-next-line no-restricted-syntax -- EFFECT INPUT
          untracked(() => {
            paint(view.offsetRadians)
          })
        })
      }
    })
    return () => {
      disposePaint()
      disposeRotate()
      clearTimeout(timer)
      if (frame !== undefined) {
        cancelAnimationFrame(frame)
      }
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
