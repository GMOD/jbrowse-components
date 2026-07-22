import { createRenderingBackend } from '@jbrowse/render-core/createRenderingBackend'

import { Canvas2DScoreRenderer } from './Canvas2DScoreRenderer.ts'
import { GpuScoreRenderer, SCORE_PASSES } from './GpuScoreRenderer.ts'
import { UNIFORMS_SIZE_BYTES } from './shaders/score.generated.ts'

import type { ScoreRenderingBackend } from './scoreTypes.ts'

// createRenderingBackend tries the GPU HAL first (WebGPU, then WebGL2) and
// falls back to Canvas2D when no GPU device is available. It's async (it awaits
// device creation), so this returns a Promise; DisplayChrome awaits it.
export function ScoreRenderer(canvas: HTMLCanvasElement) {
  return createRenderingBackend<ScoreRenderingBackend>(canvas, {
    passes: SCORE_PASSES,
    uniformByteSize: UNIFORMS_SIZE_BYTES,
    createGpuBackend: hal => new GpuScoreRenderer(hal),
    createCanvas2DBackend: c => new Canvas2DScoreRenderer(c),
  })
}
