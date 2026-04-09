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

import type { VariantMatrixBackend } from './variantMatrixBackendTypes.ts'

export function VariantMatrixRenderer(canvas: HTMLCanvasElement) {
  return initDualBackend<VariantMatrixBackend>(
    canvas,
    VARIANT_MATRIX_PASSES,
    VARIANT_MATRIX_UNIFORM_BYTE_SIZE,
    hal => new GpuVariantMatrixRenderer(hal),
    c => new Canvas2DVariantMatrixRenderer(c),
  )
}
