import { createBackend } from '@jbrowse/core/gpu/createBackend'

import { Canvas2DMafRenderer } from './Canvas2DMafRenderer.ts'
import { GpuMafRenderer, MAF_PASSES } from './GpuMafRenderer.ts'
import { UNIFORMS_SIZE_BYTES } from './shaders/maf.generated.ts'

import type { MafBackend } from './mafBackendTypes.ts'

export function MafRendererFactory(
  canvas: HTMLCanvasElement,
): Promise<MafBackend> {
  return createBackend<MafBackend>(
    canvas,
    MAF_PASSES,
    UNIFORMS_SIZE_BYTES,
    hal => new GpuMafRenderer(hal),
    c => new Canvas2DMafRenderer(c),
  )
}
