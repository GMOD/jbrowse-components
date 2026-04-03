import { createGpuHal } from '@jbrowse/core/gpu/hal'

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

const cache = new WeakMap<HTMLCanvasElement, VariantMatrixRenderer>()

export class VariantMatrixRenderer {
  private canvas: HTMLCanvasElement
  private backend: VariantMatrixBackend | null = null

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static getOrCreate(canvas: HTMLCanvasElement) {
    let r = cache.get(canvas)
    if (!r) {
      r = new VariantMatrixRenderer(canvas)
      cache.set(canvas, r)
    }
    return r
  }

  async init() {
    const hal = await createGpuHal(
      this.canvas,
      VARIANT_MATRIX_PASSES,
      VARIANT_MATRIX_UNIFORM_BYTE_SIZE,
    )
    if (hal) {
      this.backend = new GpuVariantMatrixRenderer(hal)
      return true
    }

    this.backend = new Canvas2DVariantMatrixRenderer(this.canvas)
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
    cache.delete(this.canvas)
  }
}
