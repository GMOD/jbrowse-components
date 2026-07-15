import { createRenderingBackend } from '@jbrowse/render-core/createRenderingBackend'

import { Canvas2DAlignmentsRenderer } from './Canvas2DAlignmentsRenderer.ts'
import {
  ALIGNMENTS_PASSES,
  GpuAlignmentsRenderer,
  UNIFORMS_SIZE_BYTES,
} from './GpuAlignmentsRenderer.ts'

export type { ColorPalette, RGBColor, RenderState } from './rendererTypes.ts'

import type { AlignmentsRenderingBackend } from './rendererTypes.ts'

export function AlignmentsRenderer(canvas: HTMLCanvasElement) {
  return createRenderingBackend<AlignmentsRenderingBackend>(canvas, {
    passes: ALIGNMENTS_PASSES,
    uniformByteSize: UNIFORMS_SIZE_BYTES,
    createGpuBackend: hal => new GpuAlignmentsRenderer(hal),
    createCanvas2DBackend: c => new Canvas2DAlignmentsRenderer(c),
  })
}
