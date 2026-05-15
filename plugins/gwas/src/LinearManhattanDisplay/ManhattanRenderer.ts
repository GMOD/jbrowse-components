import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

import { Canvas2DManhattanRenderer } from './Canvas2DManhattanRenderer.ts'
import { GpuManhattanRenderer, MANHATTAN_PASSES } from './GpuManhattanRenderer.ts'
import * as shader from './shaders/manhattan.generated.ts'

import type { WiggleBackend } from '@jbrowse/plugin-wiggle'

export function ManhattanRenderer(canvas: HTMLCanvasElement): Promise<WiggleBackend> {
  return initDualBackend<WiggleBackend>(
    canvas,
    MANHATTAN_PASSES,
    shader.UNIFORMS_SIZE_BYTES,
    hal => new GpuManhattanRenderer(hal),
    c => new Canvas2DManhattanRenderer(c),
  )
}
