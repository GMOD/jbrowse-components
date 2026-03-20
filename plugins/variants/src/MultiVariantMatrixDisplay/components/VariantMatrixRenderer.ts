import { getGpuOverride } from '@jbrowse/core/gpu/getGpuDevice'

import { Canvas2DVariantMatrixRenderer } from './Canvas2DVariantMatrixRenderer.ts'
import { WebGLVariantMatrixRenderer } from './WebGLVariantMatrixRenderer.ts'
import { WebGPUVariantMatrixRenderer } from './WebGPUVariantMatrixRenderer.ts'

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
    if (getGpuOverride() === 'canvas2d') {
      this.backend = new Canvas2DVariantMatrixRenderer(this.canvas)
      return true
    }

    const gpu = await WebGPUVariantMatrixRenderer.create(this.canvas)
    if (gpu) {
      this.backend = gpu
      return true
    }
    try {
      this.backend = new WebGLVariantMatrixRenderer(this.canvas)
      return true
    } catch (e) {
      console.warn('[VariantMatrixRenderer] WebGL2 fallback failed:', e)
      try {
        this.backend = new Canvas2DVariantMatrixRenderer(this.canvas)
        return true
      } catch (e2) {
        console.warn(
          '[VariantMatrixRenderer] Canvas 2D fallback also failed:',
          e2,
        )
        return false
      }
    }
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
