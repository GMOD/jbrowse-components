import { createRenderingBackend } from '@jbrowse/render-core/createRenderingBackend'

import { Canvas2DDotplotRenderer } from './Canvas2DDotplotRenderer.ts'
import { DOTPLOT_PASSES, GpuDotplotRenderer } from './GpuDotplotRenderer.ts'

import type { DotplotRenderingBackend } from './dotplotRenderingBackendTypes.ts'

export function createDotplotRenderer(canvas: HTMLCanvasElement) {
  return createRenderingBackend<DotplotRenderingBackend>(canvas, {
    passes: DOTPLOT_PASSES,
    createGpuBackend: hal => new GpuDotplotRenderer(hal),
    createCanvas2DBackend: canvas => new Canvas2DDotplotRenderer(canvas),
  })
}
