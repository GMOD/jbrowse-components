import { prepareCanvas } from '@jbrowse/core/gpu/canvas2dUtils'

import type {
  MatrixRenderState,
  VariantMatrixBackend,
} from './variantMatrixBackendTypes.ts'

export class Canvas2DVariantMatrixRenderer implements VariantMatrixBackend {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private cellFeatureIndices: Float32Array | null = null
  private cellRowIndices: Uint32Array | null = null
  private cellColors: Uint8Array | null = null
  private numCells = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D context not available')
    }
    this.ctx = ctx
  }

  uploadCellData(data: {
    cellFeatureIndices: Float32Array
    cellRowIndices: Uint32Array
    cellColors: Uint8Array
    numCells: number
  }) {
    this.cellFeatureIndices = data.cellFeatureIndices
    this.cellRowIndices = data.cellRowIndices
    this.cellColors = data.cellColors
    this.numCells = data.numCells
  }

  render(state: MatrixRenderState) {
    const { canvasWidth, canvasHeight, rowHeight, scrollTop, numFeatures } =
      state

    const ctx = this.ctx
    prepareCanvas(this.canvas, ctx, canvasWidth, canvasHeight)

    if (
      !this.cellFeatureIndices ||
      !this.cellRowIndices ||
      !this.cellColors ||
      this.numCells === 0 ||
      numFeatures === 0
    ) {
      return
    }

    const cellWidth = canvasWidth / numFeatures

    for (let i = 0; i < this.numCells; i++) {
      const featureIdx = this.cellFeatureIndices[i]!
      const rowIdx = this.cellRowIndices[i]!
      const ci = i * 4
      const r = this.cellColors[ci]!
      const g = this.cellColors[ci + 1]!
      const b = this.cellColors[ci + 2]!
      const a = this.cellColors[ci + 3]! / 255

      const x = featureIdx * cellWidth
      const y = rowIdx * rowHeight - scrollTop
      const w = Math.max(1, cellWidth)

      if (y + rowHeight < 0 || y > canvasHeight) {
        continue
      }

      ctx.fillStyle = `rgba(${r},${g},${b},${a})`
      ctx.fillRect(x, y, w, rowHeight)
    }
  }

  dispose() {
    this.cellFeatureIndices = null
    this.cellRowIndices = null
    this.cellColors = null
    this.numCells = 0
  }
}
