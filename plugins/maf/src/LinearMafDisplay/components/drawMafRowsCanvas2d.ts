import { drawRowIdentity } from './drawRowIdentity.ts'
import { drawSourceChrom } from './drawSourceChrom.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

/**
 * Paint the rows layer for whichever rendering the GPU base canvas doesn't own —
 * an identity plot (`heatmap` / `xyplot`) or color-by-source-chromosome. No-op
 * in the other two modes, where `rowsCanvas2dMode` is undefined.
 *
 * One function because the on-screen canvas (`MafRowsCanvas`) and the SVG export
 * both draw it, and each spelled out the same two-branch dispatch over the same
 * six-field geometry bundle. `rowsCanvas2dMode` exists precisely so those two
 * can't disagree about what is on screen — the duplicated dispatch under it was
 * the remaining place they could, and the export had already grown a longer
 * chain than the canvas once before.
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
  if (mode === undefined) {
    return
  }
  const state = {
    rowHeight: model.effectiveRowHeight,
    rowProportion: model.rowProportion,
    nRows: model.sources.length,
    canvasWidth,
    canvasHeight: model.rowsHeight,
    scrollTop: model.scrollTop,
  }
  if (mode === 'sourceChrom') {
    drawSourceChrom(ctx, blocks, model.rpcDataMap, {
      ...state,
      ranks: model.sourceChromRanks.ranks,
    })
  } else {
    drawRowIdentity(ctx, blocks, model.rpcDataMap, { ...state, mode })
  }
}
