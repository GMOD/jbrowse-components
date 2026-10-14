import { makeStyles } from '@jbrowse/core/util/tss-react'
import RenderCanvas from '@jbrowse/render-core/RenderCanvas'
import { useRenderingBackend } from '@jbrowse/render-core/useRenderingBackend'
import { observer } from 'mobx-react'

import { passPhase } from '../passPhase.ts'

import type { RenderLifecycleModel } from '@jbrowse/render-core/useRenderingBackend'

const useStyles = makeStyles()({
  canvas: {
    position: 'absolute',
    left: 0,
    top: 0,
    pointerEvents: 'none',
  },
})

/**
 * A canvas the size of the view's box that one of the circle's passes draws
 * on: the pass places the circle's centre, scale and rotation itself, so a
 * rotation or a zoom redraws without an upload.
 */
export const PassCanvas = observer(function PassCanvas<
  B extends {
    dispose(): void
    setErrorHandler: (handler: (error: Error) => void) => void
  },
>({
  pass,
  factory,
  view,
  testid,
}: {
  pass: RenderLifecycleModel<B> & { painted: boolean }
  factory: (canvas: HTMLCanvasElement) => Promise<B>
  view: { width: number; height: number }
  testid: string
}) {
  const { classes } = useStyles()
  const handle = useRenderingBackend(factory, pass)
  const { width, height } = view
  return (
    <RenderCanvas
      handle={handle}
      className={classes.canvas}
      style={{ width, height }}
      data-testid={testid}
      drawn={pass.painted}
      phase={passPhase(pass)}
    />
  )
})
