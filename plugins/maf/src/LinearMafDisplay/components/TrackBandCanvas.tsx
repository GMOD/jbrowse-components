import { useEffect, useRef } from 'react'

import { getPreparedCanvas2D } from '@jbrowse/render-core/canvas2dUtils'
import { useTheme } from '@mui/material'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { Theme } from '@mui/material'

/**
 * What a band paints, given the display and the theme. **A module-level
 * function, never a closure built in the parent's render** — it is an `autorun`
 * dependency, so a fresh identity per render tore the autorun down and rebuilt
 * it on every parent render. Taking the model as an argument is also what keeps
 * the reads inside the autorun: a closure over `model.conservationHeight` read
 * that value during the render instead, leaving the autorun tracking nothing
 * and the rebuild doing the redraw it looked like mobx was doing.
 */
export type BandDraw = (
  ctx: CanvasRenderingContext2D,
  model: LinearMafDisplayModel,
  theme: Theme,
) => void

/**
 * Shared absolutely-positioned band canvas for the MAF conservation band and
 * the Canvas2D rows layer. Runs `draw` inside an `autorun` so observable map
 * mutations (`rpcDataMap`/`renderBlocks`) redraw without `useEffect` deps —
 * `observable.map` keeps a stable outer reference. Hidden and not drawn when
 * `show` is false.
 *
 * `canvasWidthPx`, not `lgv.width`: every one of these bands' painters is handed
 * `canvasWidthPx` as its `canvasWidth` and clamps to it, and the GPU rows canvas
 * this one *replaces* in the identity/source-chromosome modes is that wide too.
 * Sizing the element by the view width instead left it 2px past its own
 * container (`TrackRenderingContainer` insets by the track outline under
 * `contain: strict`, so the browser clipped the overhang) with its rightmost 2px
 * unpainted — the exact drift `canvasWidthPx`'s own docstring records MAF making
 * once before.
 */
const TrackBandCanvas = observer(function TrackBandCanvas({
  model,
  top,
  height,
  show,
  draw,
}: {
  model: LinearMafDisplayModel
  top: number
  height: number
  show: boolean
  draw: BandDraw
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const width = model.canvasWidthPx
  const theme = useTheme()

  useEffect(
    () =>
      autorun(() => {
        const ctx = getPreparedCanvas2D(canvasRef.current, width, height)
        if (ctx && show) {
          draw(ctx, model, theme)
        }
      }),
    [model, width, height, show, draw, theme],
  )

  return show ? (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top,
        left: 0,
        width,
        height,
        pointerEvents: 'none',
      }}
    />
  ) : null
})

export default TrackBandCanvas
