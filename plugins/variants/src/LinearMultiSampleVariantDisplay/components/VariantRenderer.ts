import { createRenderingBackend } from '@jbrowse/core/gpu/createRenderingBackend'

import { Canvas2DVariantRenderer } from './Canvas2DVariantRenderer.ts'
import {
  GpuVariantRenderer,
  VARIANT_PASSES,
  VARIANT_UNIFORM_BYTE_SIZE,
} from './GpuVariantRenderer.ts'

import type { VariantRenderingBackend } from './variantRenderingBackendTypes.ts'

export function VariantRenderer(canvas: HTMLCanvasElement) {
  return createRenderingBackend<VariantRenderingBackend>(
    canvas,
    VARIANT_PASSES,
    VARIANT_UNIFORM_BYTE_SIZE,
    hal => new GpuVariantRenderer(hal),
    c => new Canvas2DVariantRenderer(c),
  )
}
