import { createRenderingBackend } from '@jbrowse/core/gpu/createRenderingBackend'

import { Canvas2DHicRenderer } from './Canvas2DHicRenderer.ts'
import {
  GpuHicRenderer,
  HIC_PASSES,
  HIC_UNIFORM_BYTE_SIZE,
} from './GpuHicRenderer.ts'

import type { HicRenderingBackend } from './hicRenderingBackendTypes.ts'

export function HicRenderer(canvas: HTMLCanvasElement) {
  return createRenderingBackend<HicRenderingBackend>(
    canvas,
    HIC_PASSES,
    HIC_UNIFORM_BYTE_SIZE,
    hal => new GpuHicRenderer(hal),
    c => new Canvas2DHicRenderer(c),
  )
}
