import { createBackend } from '@jbrowse/core/gpu/createBackend'

import { Canvas2DDotplotRenderer } from './Canvas2DDotplotRenderer.ts'
import {
  DOTPLOT_PASSES,
  DOTPLOT_UNIFORM_BYTE_SIZE,
  GpuDotplotRenderer,
} from './GpuDotplotRenderer.ts'

import type { DotplotBackend } from './dotplotBackendTypes.ts'

export function createDotplotRenderer(canvas: HTMLCanvasElement) {
  return createBackend<DotplotBackend>(
    canvas,
    DOTPLOT_PASSES,
    DOTPLOT_UNIFORM_BYTE_SIZE,
    hal => new GpuDotplotRenderer(hal),
    canvas => new Canvas2DDotplotRenderer(canvas),
  )
}
