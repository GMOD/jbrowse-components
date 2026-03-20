import { getGpuOverride } from '@jbrowse/core/gpu/getGpuDevice'

import { Canvas2DHicRenderer } from './Canvas2DHicRenderer.ts'
import { WebGLHicRenderer } from './WebGLHicRenderer.ts'
import { WebGPUHicRenderer } from './WebGPUHicRenderer.ts'

import type { HicBackend, HicRenderState } from './hicBackendTypes.ts'

const rendererCache = new WeakMap<HTMLCanvasElement, HicRenderer>()

export class HicRenderer {
  private canvas: HTMLCanvasElement
  private backend: HicBackend | null = null

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static getOrCreate(canvas: HTMLCanvasElement) {
    let renderer = rendererCache.get(canvas)
    if (!renderer) {
      renderer = new HicRenderer(canvas)
      rendererCache.set(canvas, renderer)
    }
    return renderer
  }

  async init() {
    if (getGpuOverride() === 'canvas2d') {
      this.backend = new Canvas2DHicRenderer(this.canvas)
      return true
    }

    const gpu = await WebGPUHicRenderer.create(this.canvas)
    if (gpu) {
      this.backend = gpu
      return true
    }

    try {
      this.backend = new WebGLHicRenderer(this.canvas)
      return true
    } catch (e) {
      console.warn('[HicRenderer] WebGL2 fallback also failed:', e)
      this.backend = new Canvas2DHicRenderer(this.canvas)
      return true
    }
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
    rendererCache.delete(this.canvas)
  }
}

export { generateColorRamp } from './WebGLHicRenderer.ts'
