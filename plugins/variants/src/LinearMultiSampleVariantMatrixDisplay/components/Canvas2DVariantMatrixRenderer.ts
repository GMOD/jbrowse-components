import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { Canvas2DGlobalRenderingBackend } from '@jbrowse/render-core/globalRenderingBackend'

import { f2 } from '../../shared/constants.ts'

import type {
  MatrixRenderState,
  VariantMatrixUploadData,
} from './variantMatrixRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

/**
 * Pure draw entry point. Paints the matrix cells (one rect per
 * variant×sample) into any 2D-canvas-like context. The on-screen
 * Canvas2DVariantMatrixRenderer wraps this with prepareCanvas; SVG export
 * calls it directly with an SvgCanvas.
 */
export function drawVariantMatrixBlocks(
  ctx: Ctx2D,
  data: VariantMatrixUploadData,
  state: { canvasWidth: number; canvasHeight: number } & Pick<
    MatrixRenderState,
    'rowHeight' | 'scrollTop'
  >,
) {
  const { canvasWidth, canvasHeight, rowHeight, scrollTop } = state
  if (data.numFeatures === 0) {
    return
  }
  const cellWidth = canvasWidth / data.numFeatures
  // Draw at float coordinates with a small overdraw (f2) so sub-pixel columns
  // antialias and blend, matching the smoother canvas2d-only rendering. Do NOT
  // pixel-snap or force a 1px minimum here (that decimates sub-pixel columns).
  // Cells are bucketed ref-then-nonref, so consecutive cells frequently share a
  // color — cache the last fillStyle to skip the abgr→css conversion (mirrors
  // the regular Canvas2DVariantRenderer).
  let prevColor = -1
  for (let i = 0; i < data.numCells; i++) {
    const y = data.cellRowIndices[i]! * rowHeight - scrollTop
    if (y + rowHeight < 0 || y > canvasHeight) {
      continue
    }
    const x = data.cellFeatureIndices[i]! * cellWidth
    const color = data.cellColors[i]!
    if (color !== prevColor) {
      ctx.fillStyle = abgrToCssRgba(color)
      prevColor = color
    }
    ctx.fillRect(x - f2, y - f2, cellWidth + f2, rowHeight + f2)
  }
}

export class Canvas2DVariantMatrixRenderer extends Canvas2DGlobalRenderingBackend<
  VariantMatrixUploadData,
  MatrixRenderState
> {
  // `prepareCanvas` is the base's (Canvas2DGlobalRenderingBackend), which is
  // also what clears the canvas on the null-payload frame.
  protected draw(data: VariantMatrixUploadData, state: MatrixRenderState) {
    if (data.numCells === 0) {
      return false
    }
    drawVariantMatrixBlocks(this.ctx, data, state)
    return true
  }
}
