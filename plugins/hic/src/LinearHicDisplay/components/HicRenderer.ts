import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

import { Canvas2DHicRenderer } from './Canvas2DHicRenderer.ts'
import {
  GpuHicRenderer,
  HIC_PASSES,
  HIC_UNIFORM_BYTE_SIZE,
} from './GpuHicRenderer.ts'

import type { HicBackend, HicRenderState } from './hicBackendTypes.ts'

export class HicRenderer {
  private canvas: HTMLCanvasElement
  private backend: HicBackend | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static getOrCreate(canvas: HTMLCanvasElement) {
    return new HicRenderer(canvas)
  }

  async init() {
    this.backend = await initDualBackend<HicBackend>(
      this.canvas,
      HIC_PASSES,
      HIC_UNIFORM_BYTE_SIZE,
      hal => new GpuHicRenderer(hal),
      canvas => new Canvas2DHicRenderer(canvas),
    )
    return true
  }

  uploadData(data: {
    positions: Float32Array
    counts: Float32Array
    numContacts: number
  }) {
    this.backend?.uploadData(data)
  }

  uploadColorRamp(colors: Uint8Array) {
    this.backend?.uploadColorRamp(colors)
  }

  render(state: HicRenderState) {
    this.backend?.render(state)
  }

  dispose() {
    this.backend?.dispose()
    this.backend = null
  }
}

export { generateColorRamp } from './colorRamp.ts'
