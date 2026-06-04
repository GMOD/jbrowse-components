import { useEffect, useRef } from 'react'

import { getPreparedCanvas2D } from '@jbrowse/core/gpu/canvas2dUtils'
import { observer } from 'mobx-react'

import { drawMafSummaryBars } from '../../LinearMafRenderer/rendering/summaryBars.ts'

import type { SummaryBar } from './computeVisibleSummaryBars.ts'
import type { MafColorPalette } from '../../LinearMafRenderer/util.ts'

// Zoom-out per-species presence bars, drawn on a backend-independent Canvas2D
// layer that composites over the (empty, at this zoom) alignment canvas exactly
// like EmptyLinesOverlay.
const SummaryBarsOverlay = observer(function SummaryBarsOverlay({
  bars,
  width,
  height,
  palette,
}: {
  bars: SummaryBar[]
  width: number
  height: number
  palette: MafColorPalette
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = getPreparedCanvas2D(canvasRef.current, width, height)
    if (ctx) {
      drawMafSummaryBars(ctx, bars, palette)
    }
  }, [bars, width, height, palette])

  if (bars.length === 0) {
    return null
  }

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

export default SummaryBarsOverlay
