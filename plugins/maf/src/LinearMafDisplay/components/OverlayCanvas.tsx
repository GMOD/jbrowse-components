import { useEffect, useRef } from 'react'

import { getPreparedCanvas2D } from '@jbrowse/render-core/canvas2dUtils'
import { observer } from 'mobx-react'

/**
 * Shared absolutely-positioned, non-interactive canvas for the MAF row overlays
 * (insertions, deletions, empty lines, labels, summary bars). Each overlay
 * passes a `draw` closure capturing its current data; the effect re-runs
 * whenever that closure or the size changes. Because the thin observer wrappers
 * only re-render when their own inputs change, `draw`'s identity changes exactly
 * when those inputs do — matching the per-overlay dependency arrays this
 * replaces, so there is no redraw on unrelated parent re-renders (e.g. hover).
 */
const OverlayCanvas = observer(function OverlayCanvas({
  width,
  height,
  draw,
}: {
  width: number
  height: number
  draw: (ctx: CanvasRenderingContext2D) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = getPreparedCanvas2D(canvasRef.current, width, height)
    if (ctx) {
      draw(ctx)
    }
  }, [draw, width, height])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: 'none',
      }}
    />
  )
})

export default OverlayCanvas
