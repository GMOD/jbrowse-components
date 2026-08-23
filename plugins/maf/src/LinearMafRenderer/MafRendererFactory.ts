import { createRenderingBackend } from '@jbrowse/render-core/createRenderingBackend'

import { Canvas2DMafRenderer } from './Canvas2DMafRenderer.ts'
import {
  GpuMafRenderer,
  MAF_PASSES,
  MAF_UNIFORM_BYTE_SIZE,
} from './GpuMafRenderer.ts'

import type { MafRenderingBackend } from './mafRenderingBackendTypes.ts'

export function MafRendererFactory(
  canvas: HTMLCanvasElement,
): Promise<MafRenderingBackend> {
  return createRenderingBackend<MafRenderingBackend>(canvas, {
    passes: MAF_PASSES,
    uniformByteSize: MAF_UNIFORM_BYTE_SIZE,
    createGpuBackend: hal => new GpuMafRenderer(hal),
    createCanvas2DBackend: c => new Canvas2DMafRenderer(c),
  })
}
