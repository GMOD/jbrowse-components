import { createRenderingBackend } from '@jbrowse/render-core/createRenderingBackend'

import { Canvas2DMultiRowRenderer } from './Canvas2DMultiRowRenderer.ts'
import { GpuMultiRowRenderer, MULTI_ROW_PASSES } from './GpuMultiRowRenderer.ts'
import { UNIFORMS_SIZE_BYTES } from './shaders/multiRow.generated.ts'

import type { MultiRowRenderingBackend } from './multiRowRenderingBackendTypes.ts'

export function MultiRowRendererFactory(
  canvas: HTMLCanvasElement,
): Promise<MultiRowRenderingBackend> {
  return createRenderingBackend<MultiRowRenderingBackend>(canvas, {
    passes: MULTI_ROW_PASSES,
    uniformByteSize: UNIFORMS_SIZE_BYTES,
    createGpuBackend: hal => new GpuMultiRowRenderer(hal),
    createCanvas2DBackend: c => new Canvas2DMultiRowRenderer(c),
  })
}
