import { createRenderingBackend } from '@jbrowse/core/gpu/createRenderingBackend'

import { Canvas2DWiggleRenderer } from './Canvas2DWiggleRenderer.ts'
import { GpuWiggleRenderer, WIGGLE_PASSES } from './GpuWiggleRenderer.ts'
import { UNIFORMS_SIZE_BYTES } from './shaders/wiggle.generated.ts'

import type { WiggleRenderingBackend } from '@jbrowse/wiggle-core'

export function WiggleRenderer(canvas: HTMLCanvasElement) {
  return createRenderingBackend<WiggleRenderingBackend>(
    canvas,
    WIGGLE_PASSES,
    UNIFORMS_SIZE_BYTES,
    hal => new GpuWiggleRenderer(hal),
    c => new Canvas2DWiggleRenderer(c),
  )
}
