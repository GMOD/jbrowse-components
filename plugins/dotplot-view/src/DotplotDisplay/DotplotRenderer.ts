import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

import { Canvas2DDotplotRenderer } from './Canvas2DDotplotRenderer.ts'
import {
  DOTPLOT_PASSES,
  DOTPLOT_UNIFORM_BYTE_SIZE,
  GpuDotplotRenderer,
} from './GpuDotplotRenderer.ts'

import type { DotplotBackend } from './dotplotBackendTypes.ts'

export function createDotplotRenderer(canvas: HTMLCanvasElement) {
  return initDualBackend<DotplotBackend>(
    canvas,
    DOTPLOT_PASSES,
    DOTPLOT_UNIFORM_BYTE_SIZE,
    hal => new GpuDotplotRenderer(hal),
    canvas => new Canvas2DDotplotRenderer(canvas),
  )
}
