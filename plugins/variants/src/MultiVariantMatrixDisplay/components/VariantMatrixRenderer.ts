import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

import { Canvas2DVariantMatrixRenderer } from './Canvas2DVariantMatrixRenderer.ts'
import {
  GpuVariantMatrixRenderer,
  VARIANT_MATRIX_PASSES,
  VARIANT_MATRIX_UNIFORM_BYTE_SIZE,
} from './GpuVariantMatrixRenderer.ts'

export type {
  MatrixRenderState,
  VariantMatrixBackend,
} from './variantMatrixBackendTypes.ts'

import type {
  MatrixRenderState,
  VariantMatrixBackend,
} from './variantMatrixBackendTypes.ts'

export class VariantMatrixRenderer {
  private canvas: HTMLCanvasElement
  private backend: VariantMatrixBackend | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static getOrCreate(canvas: HTMLCanvasElement) {
    return new VariantMatrixRenderer(canvas)
  }

  async init() {
    this.backend = await initDualBackend<VariantMatrixBackend>(
      this.canvas,
      VARIANT_MATRIX_PASSES,
      VARIANT_MATRIX_UNIFORM_BYTE_SIZE,
      hal => new GpuVariantMatrixRenderer(hal),
      canvas => new Canvas2DVariantMatrixRenderer(canvas),
    )
    return true
  }

  uploadCellData(data: {
    cellFeatureIndices: Float32Array
    cellRowIndices: Uint32Array
    cellColors: Uint8Array
    numCells: number
  }) {
    this.backend?.uploadCellData(data)
  }

  render(state: MatrixRenderState) {
    this.backend?.render(state)
  }

  dispose() {
    this.backend?.dispose()
    this.backend = null
  }
}
