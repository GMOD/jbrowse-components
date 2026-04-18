import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

import { Canvas2DWiggleRenderer } from './Canvas2DWiggleRenderer.ts'
import { GpuWiggleRenderer, WIGGLE_PASSES } from './GpuWiggleRenderer.ts'
import { UNIFORMS_SIZE_BYTES } from './shaders/wiggle.generated.ts'

import type { WiggleBackend } from './wiggleBackendTypes.ts'

export function WiggleRenderer(canvas: HTMLCanvasElement) {
  return initDualBackend<WiggleBackend>(
    canvas,
    WIGGLE_PASSES,
    UNIFORMS_SIZE_BYTES,
    GpuWiggleRenderer,
    Canvas2DWiggleRenderer,
  )
}
