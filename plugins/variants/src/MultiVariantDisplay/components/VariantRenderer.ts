import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

import { Canvas2DVariantRenderer } from './Canvas2DVariantRenderer.ts'
import {
  GpuVariantRenderer,
  VARIANT_PASSES,
  VARIANT_UNIFORM_BYTE_SIZE,
} from './GpuVariantRenderer.ts'

import type { VariantBackend } from './variantBackendTypes.ts'

export function VariantRenderer(canvas: HTMLCanvasElement) {
  return initDualBackend<VariantBackend>(
    canvas,
    VARIANT_PASSES,
    VARIANT_UNIFORM_BYTE_SIZE,
    hal => new GpuVariantRenderer(hal),
    c => new Canvas2DVariantRenderer(c),
  )
}
