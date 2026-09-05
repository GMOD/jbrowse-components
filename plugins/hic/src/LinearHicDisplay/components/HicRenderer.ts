import { createRenderingBackend } from '@jbrowse/render-core/createRenderingBackend'

import { Canvas2DHicRenderer } from './Canvas2DHicRenderer.ts'
import { GpuHicRenderer, HIC_PASSES } from './GpuHicRenderer.ts'

import type { HicRenderingBackend } from './hicRenderingBackendTypes.ts'

export function HicRenderer(canvas: HTMLCanvasElement) {
  return createRenderingBackend<HicRenderingBackend>(canvas, {
    passes: HIC_PASSES,
    createGpuBackend: hal => new GpuHicRenderer(hal),
    createCanvas2DBackend: c => new Canvas2DHicRenderer(c),
  })
}
