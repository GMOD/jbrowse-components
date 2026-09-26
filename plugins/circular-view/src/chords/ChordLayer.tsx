import { makeStyles } from '@jbrowse/core/util/tss-react'
import { createMarkBackend } from '@jbrowse/render-core/marks/backend'
import { useRenderingBackend } from '@jbrowse/render-core/useRenderingBackend'
import { observer } from 'mobx-react'

import { chordLayerMarks } from './chordMarks.ts'

import type { CircularViewModel } from '../CircularView/model.ts'
import type { ChordBackend } from './chordPass.ts'

const useStyles = makeStyles()({
  canvas: {
    position: 'absolute',
    left: 0,
    top: 0,
    pointerEvents: 'none',
  },
})

function chordFactory(canvas: HTMLCanvasElement): Promise<ChordBackend> {
  return createMarkBackend(canvas, chordLayerMarks)
}

/**
 * The chords and ribbons of every chord display, on one canvas the size of the
 * view's box above the rings. The pass places the circle's centre, scale and
 * rotation itself, so a rotation or a zoom redraws without an upload.
 */
const ChordLayer = observer(function ChordLayer({
  view,
}: {
  view: CircularViewModel
}) {
  const { classes } = useStyles()
  const pass = view.chordPass
  const { canvasRef, canvasKey } = useRenderingBackend(chordFactory, pass)
  const { width, height } = view
  return (
    <canvas
      key={canvasKey}
      ref={canvasRef}
      className={classes.canvas}
      style={{ width, height }}
      data-testid="circular-chord-canvas"
      data-display-drawn={pass.painted}
    />
  )
})

export default ChordLayer
