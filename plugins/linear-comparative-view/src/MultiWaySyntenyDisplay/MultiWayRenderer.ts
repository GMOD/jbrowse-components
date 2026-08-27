import { createRenderingBackend } from '@jbrowse/render-core/createRenderingBackend'

import { Canvas2DMultiWayRenderer } from './Canvas2DMultiWayRenderer.ts'
import {
  GpuMultiWayRenderer,
  MULTIWAY_PASSES,
  MULTIWAY_UNIFORM_BYTE_SIZE,
} from './GpuMultiWayRenderer.ts'

import type { MultiWayRenderingBackend } from './multiwayRenderTypes.ts'

export function MultiWayRenderer(canvas: HTMLCanvasElement) {
  return createRenderingBackend<MultiWayRenderingBackend>(canvas, {
    passes: MULTIWAY_PASSES,
    uniformByteSize: MULTIWAY_UNIFORM_BYTE_SIZE,
    createGpuBackend: hal => new GpuMultiWayRenderer(hal, canvas),
    createCanvas2DBackend: c => new Canvas2DMultiWayRenderer(c),
  })
}
