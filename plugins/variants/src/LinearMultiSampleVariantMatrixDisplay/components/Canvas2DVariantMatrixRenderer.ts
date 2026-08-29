import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { Canvas2DGlobalRenderingBackend } from '@jbrowse/render-core/globalRenderingBackend'

import { f2 } from '../../shared/constants.ts'
import { drawnCellHeightPx } from './shaders/variantMatrix.js.generated.ts'

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
  // The two axes take different rules, and the X one is load-bearing: draw
  // columns at float coordinates with a small overdraw (f2) so sub-pixel
  // columns antialias and blend. Do NOT pixel-snap or force a 1px minimum on
  // X — that decimates sub-pixel columns.
  //
  // Y is the opposite, because rows carry the genotype and columns do not.
  // Cells are ordered ref-then-nonref so alt paints over ref
  // (computeVariantMatrixCells), and at 2,504 samples a row is 0.09px: a
  // variant drawn `rowHeight + f2` tall covers a third of the pixel it shares
  // with ten reference cells and blends away into the grey background, while
  // the GPU paints the same variant across the whole `drawnCellHeightPx` band
  // and it survives. Measured on the 1000 Genomes phase 3 matrix: the export
  // kept 41% of the strongly-coloured variant pixels the screen showed. So a
  // sub-pixel row takes the shader's floor and its exact anchor, and a normal
  // row keeps the seam overdraw it has always had.
  const drawnRowHeight = drawnCellHeightPx(rowHeight)
  const floored = drawnRowHeight > rowHeight
  const yOffset = floored ? 0 : f2
  const drawHeight = floored ? drawnRowHeight : rowHeight + f2
  // Cells are bucketed ref-then-nonref, so consecutive cells frequently share a
  // color — cache the last fillStyle to skip the abgr→css conversion (mirrors
  // the regular Canvas2DVariantRenderer).
  let prevColor = -1
  for (let i = 0; i < data.numCells; i++) {
    const y = data.cellRowIndices[i]! * rowHeight - scrollTop
    if (y - yOffset + drawHeight < 0 || y - yOffset > canvasHeight) {
      continue
    }
    const x = data.cellFeatureIndices[i]! * cellWidth
    const color = data.cellColors[i]!
    if (color !== prevColor) {
      ctx.fillStyle = abgrToCssRgba(color)
      prevColor = color
    }
    ctx.fillRect(x - f2, y - yOffset, cellWidth + f2, drawHeight)
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
