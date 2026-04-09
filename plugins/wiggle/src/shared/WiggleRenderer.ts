import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

import { Canvas2DWiggleRenderer } from './Canvas2DWiggleRenderer.ts'
import {
  GpuWiggleRenderer,
  WIGGLE_PASSES,
  WIGGLE_UNIFORM_BYTE_SIZE,
} from './GpuWiggleRenderer.ts'

export type {
  SourceRenderData,
  WiggleBackend,
  WiggleGPURenderState,
  WiggleRenderBlock,
} from './wiggleBackendTypes.ts'

import type { WiggleBackend } from './wiggleBackendTypes.ts'

export function WiggleRenderer(canvas: HTMLCanvasElement) {
  return initDualBackend<WiggleBackend>(
    canvas,
    WIGGLE_PASSES,
    WIGGLE_UNIFORM_BYTE_SIZE,
    hal => new GpuWiggleRenderer(hal),
    c => new Canvas2DWiggleRenderer(c),
  )
}
