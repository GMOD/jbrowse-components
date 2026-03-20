import { getGpuOverride } from '@jbrowse/core/gpu/getGpuDevice'

import { Canvas2DLDRenderer } from './Canvas2DLDRenderer.ts'
import { WebGLLDRenderer } from './WebGLLDRenderer.ts'
import { WebGPULDRenderer } from './WebGPULDRenderer.ts'

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
    if (getGpuOverride() === 'canvas2d') {
      this.backend = new Canvas2DLDRenderer(this.canvas)
      return true
    }

    const gpu = await WebGPULDRenderer.create(this.canvas)
    if (gpu) {
      this.backend = gpu
      return true
    }

    try {
      this.backend = new WebGLLDRenderer(this.canvas)
      return true
    } catch (e) {
      console.warn('[LDRenderer] WebGL2 fallback failed:', e)
      try {
        this.backend = new Canvas2DLDRenderer(this.canvas)
        return true
      } catch (e2) {
        console.warn('[LDRenderer] Canvas 2D fallback also failed:', e2)
        return false
      }
    }
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
    if (this.backend) {
      this.backend.dispose()
      this.backend = null
    }
    rendererCache.delete(this.canvas)
  }
}

export { generateLDColorRamp } from './WebGLLDRenderer.ts'
