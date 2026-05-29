import { createRenderingBackend } from '@jbrowse/core/gpu/createRenderingBackend'

import { Canvas2DMafRenderer } from './Canvas2DMafRenderer.ts'
import { GpuMafRenderer, MAF_PASSES } from './GpuMafRenderer.ts'
import { UNIFORMS_SIZE_BYTES } from './shaders/maf.generated.ts'

import type { MafRenderingBackend } from './mafRenderingBackendTypes.ts'

export function MafRendererFactory(
  canvas: HTMLCanvasElement,
): Promise<MafRenderingBackend> {
  return createRenderingBackend<MafRenderingBackend>(
    canvas,
    MAF_PASSES,
    UNIFORMS_SIZE_BYTES,
    hal => new GpuMafRenderer(hal),
    c => new Canvas2DMafRenderer(c),
  )
}
