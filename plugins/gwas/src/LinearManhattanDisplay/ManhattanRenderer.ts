import { createRenderingBackend } from '@jbrowse/render-core/createRenderingBackend'

import { Canvas2DManhattanRenderer } from './Canvas2DManhattanRenderer.ts'
import {
  GpuManhattanRenderer,
  MANHATTAN_PASSES,
} from './GpuManhattanRenderer.ts'
import * as shader from './shaders/manhattan.generated.ts'

import type { ManhattanRenderingBackend } from './manhattanRenderingBackendTypes.ts'

export function ManhattanRenderer(canvas: HTMLCanvasElement) {
  return createRenderingBackend<ManhattanRenderingBackend>(canvas, {
    passes: MANHATTAN_PASSES,
    uniformByteSize: shader.UNIFORMS_SIZE_BYTES,
    createGpuBackend: hal => new GpuManhattanRenderer(hal),
    createCanvas2DBackend: c => new Canvas2DManhattanRenderer(c),
  })
}
