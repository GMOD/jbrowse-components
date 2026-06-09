import { prepareCanvas } from '@jbrowse/core/gpu/canvas2dUtils'
import { Canvas2DGlobalRenderingBackend } from '@jbrowse/core/gpu/globalRenderingBackend'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'

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
  for (let i = 0; i < data.numCells; i++) {
    const y = data.cellRowIndices[i]! * rowHeight - scrollTop
    if (y + rowHeight < 0 || y > canvasHeight) {
      continue
    }
    const x = data.cellFeatureIndices[i]! * cellWidth
    ctx.fillStyle = abgrToCssRgba(data.cellColors[i]!)
    ctx.fillRect(x - f2, y - f2, cellWidth + f2, rowHeight + f2)
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
