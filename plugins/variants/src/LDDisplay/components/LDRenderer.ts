import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

import { Canvas2DLDRenderer } from './Canvas2DLDRenderer.ts'
import {
  GpuLDRenderer,
  LD_PASSES,
  LD_UNIFORM_BYTE_SIZE,
} from './GpuLDRenderer.ts'

import type { LDBackend, LDRenderState } from './ldBackendTypes.ts'

const rendererCache = new WeakMap<HTMLCanvasElement, LDRenderer>()

export class LDRenderer {
  private canvas: HTMLCanvasElement
  private backend: LDBackend | null = null

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static getOrCreate(canvas: HTMLCanvasElement) {
    let renderer = rendererCache.get(canvas)
    if (!renderer) {
      renderer = new LDRenderer(canvas)
      rendererCache.set(canvas, renderer)
    }
    return renderer
  }

  async init() {
    this.backend = await initDualBackend<LDBackend>(
      this.canvas,
      LD_PASSES,
      LD_UNIFORM_BYTE_SIZE,
      hal => new GpuLDRenderer(hal),
      canvas => new Canvas2DLDRenderer(canvas),
    )
    return true
  }

  uploadData(data: {
    positions: Float32Array
    cellSizes: Float32Array
    ldValues: Float32Array
    numCells: number
  }) {
    this.backend?.uploadData(data)
  }

  uploadColorRamp(colors: Uint8Array) {
    this.backend?.uploadColorRamp(colors)
  }

  render(state: LDRenderState) {
    this.backend?.render(state)
  }

  dispose() {
    this.backend?.dispose()
    this.backend = null
    rendererCache.delete(this.canvas)
  }
}

export { generateLDColorRamp } from './ldColorRamp.ts'
