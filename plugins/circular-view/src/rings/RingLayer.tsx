import { Suspense } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { createMarkBackend } from '@jbrowse/render-core/marks/backend'
import { useRenderingBackend } from '@jbrowse/render-core/useRenderingBackend'
import { observer } from 'mobx-react'

import { ringMarks } from './ringMarks.ts'

import type { CircularViewModel } from '../CircularView/model.ts'
import type {
  RingBackend,
  RingDisplay,
  RingHostModel,
  RingPassModel,
} from './ringHost.ts'
import type { ComponentType } from 'react'

const useStyles = makeStyles()({
  canvas: {
    position: 'absolute',
    left: 0,
    top: 0,
    pointerEvents: 'none',
  },
  strips: {
    position: 'absolute',
    left: 0,
    top: 0,
    visibility: 'hidden',
    pointerEvents: 'none',
  },
  strip: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
})

function ringFactory(canvas: HTMLCanvasElement): Promise<RingBackend> {
  return createMarkBackend(canvas, ringMarks)
}

const RingCanvas = observer(function RingCanvas({
  pass,
  view,
}: {
  pass: RingPassModel
  view: CircularViewModel
}) {
  const { classes } = useStyles()
  const { canvasRef, canvasKey } = useRenderingBackend(ringFactory, pass)
  const { width, height } = view
  return (
    <canvas
      key={canvasKey}
      ref={canvasRef}
      className={classes.canvas}
      style={{ width, height }}
      data-testid="circular-ring-canvas"
      data-display-drawn={pass.painted}
    />
  )
})

/**
 * The rings: one canvas per group of ring passes, under the figure's SVG.
 * The ring pass places the circle's centre and rotation itself, so a canvas is
 * the view's box rather than the rotated figure.
 */
export const RingCanvases = observer(function RingCanvases({
  view,
}: {
  view: CircularViewModel
}) {
  return (
    <>
      {view.ringHost.passes.map(pass => (
        <RingCanvas key={pass.group} pass={pass} view={view} />
      ))}
    </>
  )
})

/**
 * Every ring display's own component, rendered as the linear strip it draws
 * for the ring, hidden. A display renders into its strip exactly as it does
 * into a linear genome view's track; the ring canvas samples the strip's
 * canvas, and the view routes a pointer over the ring back to the strip's
 * chrome, which is why each strip stays in the DOM under its display id.
 */
export const RingStrips = observer(function RingStrips({
  host,
}: {
  host: RingHostModel
}) {
  const { classes } = useStyles()
  const { width } = host
  return (
    <div className={classes.strips} data-testid="circular-ring-strips">
      {host.rings.map(({ display }) => {
        const Strip = display.RenderingComponent as ComponentType<{
          model: RingDisplay
        }>
        return (
          <div
            key={display.id}
            className={classes.strip}
            style={{ width, height: display.height }}
            ref={el => {
              host.setStripElement(display.id, el)
            }}
          >
            <Suspense fallback={null}>
              <Strip model={display} />
            </Suspense>
          </div>
        )
      })}
    </div>
  )
})
