import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

import { Canvas2DAlignmentsRenderer } from './Canvas2DAlignmentsRenderer.ts'
import {
  ALIGNMENTS_PASSES,
  GpuAlignmentsRenderer,
  UNIFORMS_SIZE_BYTES,
} from './GpuAlignmentsRenderer.ts'

export type { ColorPalette, RGBColor, RenderState } from './rendererTypes.ts'

import type { AlignmentsBackend } from './rendererTypes.ts'

export function AlignmentsRenderer(canvas: HTMLCanvasElement) {
  return initDualBackend<AlignmentsBackend>(
    canvas,
    ALIGNMENTS_PASSES,
    UNIFORMS_SIZE_BYTES,
    hal => new GpuAlignmentsRenderer(hal),
    c => new Canvas2DAlignmentsRenderer(c),
  )
}
