import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

import { Canvas2DHicRenderer } from './Canvas2DHicRenderer.ts'
import {
  GpuHicRenderer,
  HIC_PASSES,
  HIC_UNIFORM_BYTE_SIZE,
} from './GpuHicRenderer.ts'

export { generateColorRamp } from './colorRamp.ts'

import type { HicBackend } from './hicBackendTypes.ts'

export function HicRenderer(canvas: HTMLCanvasElement) {
  return initDualBackend<HicBackend>(
    canvas,
    HIC_PASSES,
    HIC_UNIFORM_BYTE_SIZE,
    hal => new GpuHicRenderer(hal),
    c => new Canvas2DHicRenderer(c),
  )
}
