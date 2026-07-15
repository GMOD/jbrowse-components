import { createRenderingBackend } from '@jbrowse/render-core/createRenderingBackend'

import { Canvas2DVariantRenderer } from './Canvas2DVariantRenderer.ts'
import {
  GpuVariantRenderer,
  VARIANT_PASSES,
  VARIANT_UNIFORM_BYTE_SIZE,
} from './GpuVariantRenderer.ts'

import type { VariantRenderingBackend } from './variantRenderingBackendTypes.ts'

export function VariantRenderer(canvas: HTMLCanvasElement) {
  return createRenderingBackend<VariantRenderingBackend>(canvas, {
    passes: VARIANT_PASSES,
    uniformByteSize: VARIANT_UNIFORM_BYTE_SIZE,
    createGpuBackend: hal => new GpuVariantRenderer(hal),
    createCanvas2DBackend: c => new Canvas2DVariantRenderer(c),
  })
}
