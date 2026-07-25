import { useEffect, useRef } from 'react'

import { getPreparedCanvas2D } from './canvas2dUtils.ts'

/**
 * An absolutely-positioned, non-interactive Canvas2D layer that composites over
 * a display's main canvas. Callers pass a `draw` closure capturing their
 * current data; the effect re-runs whenever that closure or the size changes.
 *
 * Wrap the caller in `observer` (mobx-react memoizes it) so the component
 * re-renders exactly when its own inputs change — `draw`'s identity then
 * changes exactly when those inputs do, and an unrelated parent re-render
 * (hover, scroll) costs no redraw.
 *
 * Lives here rather than in a plugin because the marker-overlay pattern is the
 * Canvas2D counterpart of a GPU pass: every display that draws positioned marks
 * over a rendering backend needs the same absolutely-positioned,
 * `pointerEvents: 'none'`, dpr-prepared canvas. MAF has seven such overlays;
 * alignments and canvas each had a hand-rolled copy.
 */
export default function OverlayCanvas({
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
}
