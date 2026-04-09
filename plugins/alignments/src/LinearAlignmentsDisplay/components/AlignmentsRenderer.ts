import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

import { Canvas2DAlignmentsRenderer } from './Canvas2DAlignmentsRenderer.ts'
import {
  ALIGNMENTS_PASSES,
  GpuAlignmentsRenderer,
} from './GpuAlignmentsRenderer.ts'
import { UNIFORM_SIZE } from './wgsl/common.ts'

export type { ColorPalette, RGBColor, RenderState } from './rendererTypes.ts'

import type { AlignmentsBackend } from './rendererTypes.ts'

export function AlignmentsRenderer(canvas: HTMLCanvasElement) {
  return initDualBackend<AlignmentsBackend>(
    canvas,
    ALIGNMENTS_PASSES,
    UNIFORM_SIZE,
    hal => new GpuAlignmentsRenderer(hal),
    c => new Canvas2DAlignmentsRenderer(c),
  )
}
