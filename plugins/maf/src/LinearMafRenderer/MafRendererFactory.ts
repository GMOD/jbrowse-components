import { createRenderingBackend } from '@jbrowse/render-core/createRenderingBackend'

import { Canvas2DMafRenderer } from './Canvas2DMafRenderer.ts'
import { GpuMafRenderer, MAF_PASSES } from './GpuMafRenderer.ts'
import { UNIFORMS_SIZE_BYTES } from './shaders/maf.generated.ts'

import type { MafRenderingBackend } from './mafRenderingBackendTypes.ts'

export function MafRendererFactory(
  canvas: HTMLCanvasElement,
): Promise<MafRenderingBackend> {
  return createRenderingBackend<MafRenderingBackend>(canvas, {
    passes: MAF_PASSES,
    uniformByteSize: UNIFORMS_SIZE_BYTES,
    createGpuBackend: hal => new GpuMafRenderer(hal),
    createCanvas2DBackend: c => new Canvas2DMafRenderer(c),
  })
}
