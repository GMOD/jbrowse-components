import { getGpuOverride } from '@jbrowse/core/gpu/getGpuDevice'

import { Canvas2DSyntenyRenderer } from './Canvas2DSyntenyRenderer.ts'
import { WebGLSyntenyRenderer } from './WebGLSyntenyRenderer.ts'
import { WebGPUSyntenyRenderer } from './WebGPUSyntenyRenderer.ts'

import type { SyntenyBackend } from './syntenyBackendTypes.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/executeSyntenyInstanceData.ts'

const cache = new WeakMap<HTMLCanvasElement, SyntenyRenderer>()

export class SyntenyRenderer {
  private canvas: HTMLCanvasElement
  private backend: SyntenyBackend | null = null

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static getOrCreate(canvas: HTMLCanvasElement) {
    let r = cache.get(canvas)
    if (!r) {
      r = new SyntenyRenderer(canvas)
      cache.set(canvas, r)
    }
    return r
  }

  async init() {
    if (getGpuOverride() === 'canvas2d') {
      this.backend = new Canvas2DSyntenyRenderer(this.canvas)
      return true
    }

    const gpu = await WebGPUSyntenyRenderer.create(this.canvas)
    if (gpu) {
      this.backend = gpu
      return true
    }
    try {
      this.backend = new WebGLSyntenyRenderer(this.canvas)
      return true
    } catch (e) {
      console.warn('[SyntenyRenderer] WebGL2 fallback also failed:', e)
      this.backend = new Canvas2DSyntenyRenderer(this.canvas)
      return true
    }
  }

  resize(width: number, height: number) {
    this.backend?.resize(width, height)
  }

  uploadGeometry(data: SyntenyInstanceData) {
    this.backend?.uploadGeometry(data)
  }

  render(
    offset0: number,
    offset1: number,
    height: number,
    curBpPerPx0: number,
    curBpPerPx1: number,
    maxOffScreenPx: number,
    minAlignmentLength: number,
    alpha: number,
    hoveredFeatureId: number,
    clickedFeatureId: number,
  ) {
    this.backend?.render(
      offset0,
      offset1,
      height,
      curBpPerPx0,
      curBpPerPx1,
      maxOffScreenPx,
      minAlignmentLength,
      alpha,
      hoveredFeatureId,
      clickedFeatureId,
    )
  }

  pick(x: number, y: number, onResult?: (result: number) => void) {
    return this.backend?.pick(x, y, onResult)
  }

  dispose() {
    this.backend?.dispose()
    this.backend = null
    cache.delete(this.canvas)
  }
}
