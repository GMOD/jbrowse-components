import { createRenderingBackend } from '@jbrowse/render-core/createRenderingBackend'

import { Canvas2DWiggleRenderer } from './Canvas2DWiggleRenderer.ts'
import { GpuWiggleRenderer, WIGGLE_PASSES } from './GpuWiggleRenderer.ts'
import { UNIFORMS_SIZE_BYTES } from './shaders/wiggle.iface.generated.ts'

import type { WiggleRenderingBackend } from '@jbrowse/wiggle-core'

export function WiggleRenderer(canvas: HTMLCanvasElement) {
  return createRenderingBackend<WiggleRenderingBackend>(canvas, {
    passes: WIGGLE_PASSES,
    uniformByteSize: UNIFORMS_SIZE_BYTES,
    createGpuBackend: hal => new GpuWiggleRenderer(hal),
    createCanvas2DBackend: c => new Canvas2DWiggleRenderer(c),
  })
}
