import { prepareCanvas } from '@jbrowse/core/gpu/canvas2dUtils'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'

import type {
  MatrixRenderState,
  VariantMatrixBackend,
  VariantMatrixUploadData,
} from './variantMatrixBackendTypes.ts'

export class Canvas2DVariantMatrixRenderer implements VariantMatrixBackend {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private data: VariantMatrixUploadData | undefined

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D context not available')
    }
    this.ctx = ctx
  }

  uploadCellData(data: VariantMatrixUploadData) {
    this.data = data.numCells === 0 ? undefined : data
  }

  render(state: MatrixRenderState) {
    const { canvasWidth, canvasHeight, rowHeight, scrollTop } = state

    const ctx = this.ctx
    prepareCanvas(this.canvas, ctx, canvasWidth, canvasHeight)

    const data = this.data
    if (!data || data.numFeatures === 0) {
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

  dispose() {
    this.data = undefined
  }
}
