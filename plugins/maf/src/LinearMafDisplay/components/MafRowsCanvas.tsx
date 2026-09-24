import { observer } from 'mobx-react'

import TrackBandCanvas from './TrackBandCanvas.tsx'
import { drawMafRowsCanvas2d } from './drawMafRowsCanvas2d.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'

/**
 * The Canvas2D rows layer for the per-row identity plot (`heatmap` / `xyplot`),
 * which the rendering backend's marks don't draw. In those modes the row marks
 * paint nothing, so this replaces them rather than overlaying them; in every
 * other mode it stays hidden. Its parent div is already offset to
 * `rowsTopOffset`. The draw is `drawMafRowsCanvas2d`, shared with the SVG
 * export.
 */
// Module level, so the autorun in TrackBandCanvas is built once — see BandDraw.
function drawRows(ctx: CanvasRenderingContext2D, model: LinearMafDisplayModel) {
  drawMafRowsCanvas2d(ctx, model, model.renderBlocks, model.canvasWidthPx)
}

const MafRowsCanvas = observer(function MafRowsCanvas({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  const { rowsCanvas2dMode, rowsHeight, sources } = model
  return (
    <TrackBandCanvas
      model={model}
      top={0}
      height={rowsHeight}
      show={rowsCanvas2dMode !== undefined && sources.length > 0}
      draw={drawRows}
    />
  )
})

export default MafRowsCanvas
