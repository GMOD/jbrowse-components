import { createRenderingBackend } from '@jbrowse/core/gpu/createRenderingBackend'

import { Canvas2DManhattanRenderer } from './Canvas2DManhattanRenderer.ts'
import {
  GpuManhattanRenderer,
  MANHATTAN_PASSES,
} from './GpuManhattanRenderer.ts'
import * as shader from './shaders/manhattan.generated.ts'

import type { ManhattanRenderingBackend } from './manhattanRenderingBackendTypes.ts'

export function ManhattanRenderer(canvas: HTMLCanvasElement) {
  return createRenderingBackend<ManhattanRenderingBackend>(
    canvas,
    MANHATTAN_PASSES,
    shader.UNIFORMS_SIZE_BYTES,
    hal => new GpuManhattanRenderer(hal),
    c => new Canvas2DManhattanRenderer(c),
  )
}
