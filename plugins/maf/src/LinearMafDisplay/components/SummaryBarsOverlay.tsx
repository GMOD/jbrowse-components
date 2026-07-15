import { observer } from 'mobx-react'

import OverlayCanvas from './OverlayCanvas.tsx'
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
  if (bars.length === 0) {
    return null
  }
  return (
    <OverlayCanvas
      width={width}
      height={height}
      draw={ctx => {
        drawMafSummaryBars(ctx, bars, palette)
      }}
    />
  )
})

export default SummaryBarsOverlay
