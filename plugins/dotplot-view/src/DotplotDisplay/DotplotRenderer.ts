import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

import { Canvas2DDotplotRenderer } from './Canvas2DDotplotRenderer.ts'
import {
  DOTPLOT_PASSES,
  DOTPLOT_UNIFORM_BYTE_SIZE,
  GpuDotplotRenderer,
} from './GpuDotplotRenderer.ts'

import type {
  DotplotBackend,
  DotplotGeometryData,
} from './dotplotBackendTypes.ts'

const rendererCache = new WeakMap<HTMLCanvasElement, DotplotRenderer>()

export class DotplotRenderer {
  private canvas: HTMLCanvasElement
  private backend: DotplotBackend | null = null

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static getOrCreate(canvas: HTMLCanvasElement) {
    let renderer = rendererCache.get(canvas)
    if (!renderer) {
      renderer = new DotplotRenderer(canvas)
      rendererCache.set(canvas, renderer)
    }
    return renderer
  }

  async init() {
    this.backend = await initDualBackend<DotplotBackend>(
      this.canvas,
      DOTPLOT_PASSES,
      DOTPLOT_UNIFORM_BYTE_SIZE,
      hal => new GpuDotplotRenderer(hal),
      canvas => new Canvas2DDotplotRenderer(canvas),
    )
    return true
  }

  resize(width: number, height: number) {
    this.backend?.resize(width, height)
  }

  uploadGeometry(data: DotplotGeometryData) {
    this.backend?.uploadGeometry(data)
  }

  render(
    offsetX: number,
    offsetY: number,
    lineWidth: number,
    scaleX: number,
    scaleY: number,
  ) {
    this.backend?.render(offsetX, offsetY, lineWidth, scaleX, scaleY)
  }

  dispose() {
    this.backend?.dispose()
    this.backend = null
    rendererCache.delete(this.canvas)
  }
}
