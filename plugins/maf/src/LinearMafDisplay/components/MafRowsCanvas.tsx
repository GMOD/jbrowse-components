import { observer } from 'mobx-react'

import TrackBandCanvas from './TrackBandCanvas.tsx'
import { drawMafRowsCanvas2d } from './drawMafRowsCanvas2d.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'

/**
 * The Canvas2D rows layer, for the renderings the GPU base canvas doesn't paint:
 * a per-row identity plot (`heatmap` / `xyplot`) or color-by-source-chromosome.
 * In those modes the base canvas paints nothing, so this replaces it rather than
 * overlaying it; `bases` and `codon` draw elsewhere (GPU canvas / codon overlay)
 * and this stays hidden. Its parent div is already offset to `rowsTopOffset`.
 *
 * One component for both because they differ only in the draw call — as two they
 * had already grown two spellings of the same show test and nRows read. The draw
 * itself is `drawMafRowsCanvas2d`, shared with the SVG export for the same
 * reason.
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
