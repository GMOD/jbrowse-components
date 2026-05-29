import { createRenderingBackend } from '@jbrowse/core/gpu/createRenderingBackend'

import { Canvas2DLDRenderer } from './Canvas2DLDRenderer.ts'
import {
  GpuLDRenderer,
  LD_PASSES,
  LD_UNIFORM_BYTE_SIZE,
} from './GpuLDRenderer.ts'

import type { LDRenderingBackend } from './ldRenderingBackendTypes.ts'

export function LDRenderer(canvas: HTMLCanvasElement) {
  return createRenderingBackend<LDRenderingBackend>(
    canvas,
    LD_PASSES,
    LD_UNIFORM_BYTE_SIZE,
    hal => new GpuLDRenderer(hal),
    c => new Canvas2DLDRenderer(c),
  )
}
