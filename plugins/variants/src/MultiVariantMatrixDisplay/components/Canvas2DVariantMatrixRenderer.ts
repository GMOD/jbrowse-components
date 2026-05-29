import { prepareCanvas } from '@jbrowse/core/gpu/canvas2dUtils'
import { Canvas2DGlobalRenderingBackend } from '@jbrowse/core/gpu/globalRenderingBackend'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'

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
  for (let i = 0; i < data.numCells; i++) {
    const y = data.cellRowIndices[i]! * rowHeight - scrollTop
    if (y + rowHeight < 0 || y > canvasHeight) {
      continue
    }
    // Match shader pixel-snap: round each edge to the nearest pixel and
    // enforce a 1px minimum width (variantMatrix.slang:42-43).
    const featureIndex = data.cellFeatureIndices[i]!
    const cx1 = Math.round(featureIndex * cellWidth)
    const cx2 = Math.max(Math.round((featureIndex + 1) * cellWidth), cx1 + 1)
    ctx.fillStyle = abgrToCssRgba(data.cellColors[i]!)
    ctx.fillRect(cx1, y, cx2 - cx1, rowHeight)
  }
}

export class Canvas2DVariantMatrixRenderer extends Canvas2DGlobalRenderingBackend<
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
