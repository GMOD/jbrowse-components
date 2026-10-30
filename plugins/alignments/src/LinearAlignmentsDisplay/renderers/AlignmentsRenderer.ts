import { createRenderingBackend } from '@jbrowse/render-core/createRenderingBackend'

import { Canvas2DAlignmentsRenderer } from './Canvas2DAlignmentsRenderer.ts'
import {
  ALIGNMENTS_PASSES,
  GpuAlignmentsRenderer,
} from './GpuAlignmentsRenderer.ts'

import type { AlignmentsRenderingBackend } from './rendererTypes.ts'

// One sample, though most pileup and coverage passes draw hard edges: the
// multisampled target held 340 MiB on a tall track at dpr 2
// (ARCHITECTURAL_LIMITS.md). What one sample costs, the coverage band's
// sub-pixel segments drawing whole or not at all among them:
// agent-docs/handoffs/msaa-remaining-displays.md.
export function AlignmentsRenderer(canvas: HTMLCanvasElement) {
  return createRenderingBackend<AlignmentsRenderingBackend>(canvas, {
    passes: ALIGNMENTS_PASSES,
    sampleCount: 1,
    createGpuBackend: hal => new GpuAlignmentsRenderer(hal),
    createCanvas2DBackend: c => new Canvas2DAlignmentsRenderer(c),
  })
}
