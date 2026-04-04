import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

import { Canvas2DSequenceRenderer } from './Canvas2DSequenceRenderer.ts'
import { GpuSequenceRenderer, SEQUENCE_PASSES } from './GpuSequenceRenderer.ts'
import { UNIFORM_BYTE_SIZE } from './sequenceShaders.ts'

import type { SequenceBackend } from './sequenceBackendTypes.ts'

export class SequenceRenderer {
  private canvas: HTMLCanvasElement
  private backend: SequenceBackend | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static getOrCreate(canvas: HTMLCanvasElement) {
    return new SequenceRenderer(canvas)
  }

  async init() {
    this.backend = await initDualBackend<SequenceBackend>(
      this.canvas,
      SEQUENCE_PASSES,
      UNIFORM_BYTE_SIZE,
      hal => new GpuSequenceRenderer(hal),
      c => new Canvas2DSequenceRenderer(c),
    )
    return true
  }

  uploadGeometry(
    rectBuf: Float32Array,
    colorBuf: Uint8Array,
    instanceCount: number,
  ) {
    this.backend?.uploadGeometry(rectBuf, colorBuf, instanceCount)
  }

  render(
    instanceCount: number,
    basePx: number,
    bpPerPx: number,
    cssWidth: number,
    cssHeight: number,
  ) {
    this.backend?.render(instanceCount, basePx, bpPerPx, cssWidth, cssHeight)
  }

  dispose() {
    this.backend?.dispose()
    this.backend = null
  }
}
