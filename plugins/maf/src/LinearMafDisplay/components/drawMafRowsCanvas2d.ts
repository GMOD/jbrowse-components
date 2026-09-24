import { drawRowIdentity } from './drawRowIdentity.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

/**
 * Paint the identity plot (`heatmap` / `xyplot`) when it is the rows rendering;
 * no-op otherwise, where `rowsCanvas2dMode` is undefined.
 *
 * One function because the on-screen canvas (`MafRowsCanvas`) and the SVG export
 * both draw it off the same six-field geometry bundle, so the two cannot
 * disagree about what is on screen.
 *
 * `blocks` and `canvasWidth` are the caller's: the export paints into its own
 * shell, which is a different width and a different block set than the live
 * canvas's `renderBlocks` / `canvasWidthPx`.
 */
export function drawMafRowsCanvas2d(
  ctx: Ctx2D,
  model: LinearMafDisplayModel,
  blocks: RenderBlock[],
  canvasWidth: number,
) {
  const mode = model.rowsCanvas2dMode
  if (mode !== undefined) {
    drawRowIdentity(ctx, blocks, model.rpcDataMap, {
      rowHeight: model.effectiveRowHeight,
      rowProportion: model.rowProportion,
      nRows: model.sources.length,
      canvasWidth,
      canvasHeight: model.rowsHeight,
      scrollTop: model.scrollTop,
      mode,
    })
  }
}
