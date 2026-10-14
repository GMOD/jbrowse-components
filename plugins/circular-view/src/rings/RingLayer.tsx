import { Suspense } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { createMarkBackend } from '@jbrowse/render-core/marks/backend'
import { observer } from 'mobx-react'

import { PassCanvas } from '../CircularView/components/PassCanvas.tsx'
import { ringMarks } from './ringMarks.ts'

import type { CircularViewModel } from '../CircularView/model.ts'
import type { RingBackend, RingDisplay, RingHostModel } from './ringHost.ts'
import type { ComponentType } from 'react'

const useStyles = makeStyles()({
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
        <PassCanvas
          key={pass.group}
          pass={pass}
          factory={ringFactory}
          view={view}
          testid="circular-ring-canvas"
        />
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
