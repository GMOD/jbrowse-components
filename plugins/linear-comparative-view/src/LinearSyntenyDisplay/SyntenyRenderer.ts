import { createRenderingBackend } from '@jbrowse/core/gpu/createRenderingBackend'

import { Canvas2DSyntenyRenderer } from './Canvas2DSyntenyRenderer.ts'
import {
  GpuSyntenyRenderer,
  SYNTENY_PASSES,
  SYNTENY_UNIFORM_BYTE_SIZE,
} from './GpuSyntenyRenderer.ts'

import type { SyntenyRenderingBackend } from './syntenyRenderingBackendTypes.ts'

export function SyntenyRendererFactory(canvas: HTMLCanvasElement) {
  return createRenderingBackend<SyntenyRenderingBackend>(
    canvas,
    SYNTENY_PASSES,
    SYNTENY_UNIFORM_BYTE_SIZE,
    hal => new GpuSyntenyRenderer(hal, canvas),
    c => new Canvas2DSyntenyRenderer(c),
  )
}
