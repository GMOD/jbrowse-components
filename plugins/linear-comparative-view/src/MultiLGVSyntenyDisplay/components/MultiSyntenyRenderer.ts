import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

import { Canvas2DMultiSyntenyRenderer } from './Canvas2DMultiSyntenyRenderer.ts'
import {
  GpuMultiSyntenyRenderer,
  SYNTENY_PASSES,
  SYNTENY_UNIFORM_BYTE_SIZE,
} from './GpuMultiSyntenyRenderer.ts'

import type { MultiSyntenyBackend } from './rendererTypes.ts'

export function MultiSyntenyRenderer(canvas: HTMLCanvasElement) {
  return initDualBackend<MultiSyntenyBackend>(
    canvas,
    SYNTENY_PASSES,
    SYNTENY_UNIFORM_BYTE_SIZE,
    hal => new GpuMultiSyntenyRenderer(hal),
    c => new Canvas2DMultiSyntenyRenderer(c),
  )
}
