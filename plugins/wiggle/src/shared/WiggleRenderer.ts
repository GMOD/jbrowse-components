import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

import { Canvas2DWiggleRenderer } from './Canvas2DWiggleRenderer.ts'
import { GpuWiggleRenderer, WIGGLE_PASSES } from './GpuWiggleRenderer.ts'
import { UNIFORMS_SIZE_BYTES } from './shaders/wiggle.generated.ts'

import type { WiggleBackend } from './wiggleBackendTypes.ts'

export function WiggleRenderer(canvas: HTMLCanvasElement) {
  console.warn('[WiggleRenderer] factory called, canvas:', {
    width: canvas.width,
    height: canvas.height,
    id: canvas.id,
  })
  return initDualBackend<WiggleBackend>(
    canvas,
    WIGGLE_PASSES,
    UNIFORMS_SIZE_BYTES,
    hal => {
      console.warn('[WiggleRenderer] Creating GPU wiggle renderer')
      return new GpuWiggleRenderer(hal)
    },
    c => {
      console.warn('[WiggleRenderer] Creating Canvas2D wiggle renderer')
      return new Canvas2DWiggleRenderer(c)
    },
  )
}
