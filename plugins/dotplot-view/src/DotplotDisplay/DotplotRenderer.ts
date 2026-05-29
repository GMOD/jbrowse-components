import { createRenderingBackend } from '@jbrowse/core/gpu/createRenderingBackend'

import { Canvas2DDotplotRenderer } from './Canvas2DDotplotRenderer.ts'
import {
  DOTPLOT_PASSES,
  DOTPLOT_UNIFORM_BYTE_SIZE,
  GpuDotplotRenderer,
} from './GpuDotplotRenderer.ts'

import type { DotplotRenderingBackend } from './dotplotRenderingBackendTypes.ts'

export function createDotplotRenderer(canvas: HTMLCanvasElement) {
  return createRenderingBackend<DotplotRenderingBackend>(
    canvas,
    DOTPLOT_PASSES,
    DOTPLOT_UNIFORM_BYTE_SIZE,
    hal => new GpuDotplotRenderer(hal),
    canvas => new Canvas2DDotplotRenderer(canvas),
  )
}
