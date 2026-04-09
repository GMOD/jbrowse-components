import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

import { Canvas2DLDRenderer } from './Canvas2DLDRenderer.ts'
import {
  GpuLDRenderer,
  LD_PASSES,
  LD_UNIFORM_BYTE_SIZE,
} from './GpuLDRenderer.ts'

export { generateLDColorRamp } from './ldColorRamp.ts'

import type { LDBackend } from './ldBackendTypes.ts'

export function LDRenderer(canvas: HTMLCanvasElement) {
  return initDualBackend<LDBackend>(
    canvas,
    LD_PASSES,
    LD_UNIFORM_BYTE_SIZE,
    hal => new GpuLDRenderer(hal),
    c => new Canvas2DLDRenderer(c),
  )
}
