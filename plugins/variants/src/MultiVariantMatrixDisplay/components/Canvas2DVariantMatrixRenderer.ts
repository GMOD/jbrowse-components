import { prepareCanvas } from '@jbrowse/core/gpu/canvas2dUtils'
import { Canvas2DMonolithicBackend } from '@jbrowse/core/gpu/monolithicBackend'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'

import type {
  MatrixRenderState,
  VariantMatrixUploadData,
} from './variantMatrixBackendTypes.ts'
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
  const w = Math.max(2, cellWidth)
  for (let i = 0; i < data.numCells; i++) {
    const y = data.cellRowIndices[i]! * rowHeight - scrollTop
    if (y + rowHeight < 0 || y > canvasHeight) {
      continue
    }
    ctx.fillStyle = abgrToCssRgba(data.cellColors[i]!)
    ctx.fillRect(data.cellFeatureIndices[i]! * cellWidth, y, w, rowHeight)
  }
}

export class Canvas2DVariantMatrixRenderer extends Canvas2DMonolithicBackend<
  VariantMatrixUploadData,
  MatrixRenderState
> {
  render(data: VariantMatrixUploadData | null, state: MatrixRenderState) {
    prepareCanvas(this.canvas, this.ctx, state.canvasWidth, state.canvasHeight)
    if (data && data.numCells > 0) {
      drawVariantMatrixBlocks(this.ctx, data, state)
    }
  }
}
