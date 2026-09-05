import { createRenderingBackend } from '@jbrowse/render-core/createRenderingBackend'

import { Canvas2DSyntenyRenderer } from './Canvas2DSyntenyRenderer.ts'
import { GpuSyntenyRenderer, SYNTENY_PASSES } from './GpuSyntenyRenderer.ts'

import type { SyntenyRenderingBackend } from './syntenyRenderingBackendTypes.ts'

export function SyntenyRendererFactory(canvas: HTMLCanvasElement) {
  return createRenderingBackend<SyntenyRenderingBackend>(canvas, {
    passes: SYNTENY_PASSES,
    createGpuBackend: hal => new GpuSyntenyRenderer(hal, canvas),
    createCanvas2DBackend: c => new Canvas2DSyntenyRenderer(c),
  })
}
