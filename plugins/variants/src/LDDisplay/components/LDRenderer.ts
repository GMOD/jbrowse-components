import { createRenderingBackend } from '@jbrowse/render-core/createRenderingBackend'

import { Canvas2DLDRenderer } from './Canvas2DLDRenderer.ts'
import {
  GpuLDRenderer,
  LD_PASSES,
  LD_UNIFORM_BYTE_SIZE,
} from './GpuLDRenderer.ts'

import type { LDRenderingBackend } from './ldRenderingBackendTypes.ts'

export function LDRenderer(canvas: HTMLCanvasElement) {
  return createRenderingBackend<LDRenderingBackend>(canvas, {
    passes: LD_PASSES,
    uniformByteSize: LD_UNIFORM_BYTE_SIZE,
    createGpuBackend: hal => new GpuLDRenderer(hal),
    createCanvas2DBackend: c => new Canvas2DLDRenderer(c),
  })
}
