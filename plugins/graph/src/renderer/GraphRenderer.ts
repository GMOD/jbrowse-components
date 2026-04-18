import { getGpuOverride } from '@jbrowse/core/gpu/getGpuDevice'

import { Canvas2DRenderer } from './Canvas2DRenderer.ts'
import { WebGL2Renderer } from './WebGL2Renderer.ts'
import { WebGPURenderer } from './WebGPURenderer.ts'

import type {
  RenderBatch,
  Renderer,
  SubBatchKey,
  TransformUniform,
} from './types.ts'

export class GraphRenderer {
  private canvas: HTMLCanvasElement
  private backend: Renderer | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  async init() {
    if (getGpuOverride() === 'canvas2d') {
      this.backend = new Canvas2DRenderer(this.canvas)
      return
    }

    const gpu = await WebGPURenderer.create(this.canvas)
    if (gpu) {
      this.backend = gpu
      return
    }

    try {
      this.backend = new WebGL2Renderer(this.canvas)
    } catch (e) {
      console.warn('[GraphRenderer] WebGL2 fallback failed:', e)
      this.backend = new Canvas2DRenderer(this.canvas)
    }
  }

  resize(width: number, height: number) {
    this.backend?.resize(width, height)
  }

  uploadGeometry(batch: RenderBatch) {
    this.backend?.uploadGeometry(batch)
  }

  updateSubBatchColors(
    target: SubBatchKey,
    colors: Uint32Array,
    vertexStart: number,
  ) {
    this.backend?.updateSubBatchColors(target, colors, vertexStart)
  }

  updateTransform(transform: TransformUniform) {
    this.backend?.updateTransform(transform)
  }

  render(clearColor: [number, number, number, number]) {
    this.backend?.render(clearColor)
  }

  destroy() {
    this.backend?.destroy()
    this.backend = null
  }
}
