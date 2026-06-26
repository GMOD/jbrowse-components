import { useEffect, useRef } from 'react'

import { getPreparedCanvas2D } from '@jbrowse/render-core/canvas2dUtils'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import type { LinearMafDisplayModel } from '../stateModel.ts'

/**
 * Shared absolutely-positioned band canvas for the MAF coverage / conservation /
 * row-identity bands. Runs `draw` inside an `autorun` so observable map
 * mutations (`rpcDataMap`/`renderBlocks`) redraw without `useEffect` deps —
 * `observable.map` keeps a stable outer reference. Hidden and not drawn when
 * `show` is false.
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
  draw: (ctx: CanvasRenderingContext2D) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { width } = model.lgv

  useEffect(
    () =>
      autorun(() => {
        const ctx = getPreparedCanvas2D(canvasRef.current, width, height)
        if (ctx && show) {
          draw(ctx)
        }
      }),
    [width, height, show, draw],
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
