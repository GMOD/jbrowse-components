import { createRenderingBackend } from '@jbrowse/core/gpu/createRenderingBackend'

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
  return createRenderingBackend<VariantMatrixRenderingBackend>(
    canvas,
    VARIANT_MATRIX_PASSES,
    VARIANT_MATRIX_UNIFORM_BYTE_SIZE,
    hal => new GpuVariantMatrixRenderer(hal),
    c => new Canvas2DVariantMatrixRenderer(c),
  )
}
