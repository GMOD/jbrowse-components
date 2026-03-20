import { getGpuOverride } from '@jbrowse/core/gpu/getGpuDevice'

import { Canvas2DDotplotRenderer } from './Canvas2DDotplotRenderer.ts'
import { WebGLDotplotRenderer } from './WebGLDotplotRenderer.ts'
import { WebGPUDotplotRenderer } from './WebGPUDotplotRenderer.ts'

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
    if (getGpuOverride() === 'canvas2d') {
      this.backend = new Canvas2DDotplotRenderer(this.canvas)
      return true
    }

    const gpu = await WebGPUDotplotRenderer.create(this.canvas)
    if (gpu) {
      this.backend = gpu
      return true
    }
    try {
      this.backend = new WebGLDotplotRenderer(this.canvas)
      return true
    } catch (e) {
      console.warn('[DotplotRenderer] WebGL2 fallback also failed:', e)
      this.backend = new Canvas2DDotplotRenderer(this.canvas)
      return true
    }
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
