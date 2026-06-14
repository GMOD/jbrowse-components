import { createRenderingBackend } from '@jbrowse/render-core/createRenderingBackend'

import { Canvas2DVariantMatrixRenderer } from './Canvas2DVariantMatrixRenderer.ts'
import {
  GpuVariantMatrixRenderer,
  VARIANT_MATRIX_PASSES,
  VARIANT_MATRIX_UNIFORM_BYTE_SIZE,
} from './GpuVariantMatrixRenderer.ts'

import type { VariantMatrixRenderingBackend } from './variantMatrixRenderingBackendTypes.ts'

export type {
  MatrixRenderState,
  VariantMatrixRenderingBackend,
} from './variantMatrixRenderingBackendTypes.ts'

export function VariantMatrixRenderer(canvas: HTMLCanvasElement) {
  return createRenderingBackend<VariantMatrixRenderingBackend>(canvas, {
    passes: VARIANT_MATRIX_PASSES,
    uniformByteSize: VARIANT_MATRIX_UNIFORM_BYTE_SIZE,
    createGpuBackend: hal => new GpuVariantMatrixRenderer(hal),
    createCanvas2DBackend: c => new Canvas2DVariantMatrixRenderer(c),
  })
}
