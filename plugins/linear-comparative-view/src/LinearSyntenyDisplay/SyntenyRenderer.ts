import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

import { Canvas2DSyntenyRenderer } from './Canvas2DSyntenyRenderer.ts'
import {
  GpuSyntenyRenderer,
  SYNTENY_PASSES,
  SYNTENY_UNIFORM_BYTE_SIZE,
} from './GpuSyntenyRenderer.ts'

import type { SyntenyBackend } from './syntenyBackendTypes.ts'

export function SyntenyRendererFactory(canvas: HTMLCanvasElement) {
  return initDualBackend<SyntenyBackend>(
    canvas,
    SYNTENY_PASSES,
    SYNTENY_UNIFORM_BYTE_SIZE,
    hal => new GpuSyntenyRenderer(hal, canvas),
    c => new Canvas2DSyntenyRenderer(c),
  )
}
