import { getGpuOverride } from '@jbrowse/core/gpu/getGpuDevice'

import { Canvas2DVariantRenderer } from './Canvas2DVariantRenderer.ts'
import { WebGLVariantRenderer } from './WebGLVariantRenderer.ts'
import { WebGPUVariantRenderer } from './WebGPUVariantRenderer.ts'

import type {
  VariantBackend,
  VariantRenderBlock,
} from './variantBackendTypes.ts'

const rendererCache = new WeakMap<HTMLCanvasElement, VariantRenderer>()

export class VariantRenderer {
  private canvas: HTMLCanvasElement
  private backend: VariantBackend | null = null

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static getOrCreate(canvas: HTMLCanvasElement) {
    let renderer = rendererCache.get(canvas)
    if (!renderer) {
      renderer = new VariantRenderer(canvas)
      rendererCache.set(canvas, renderer)
    }
    return renderer
  }

  async init() {
    if (getGpuOverride() === 'canvas2d') {
      this.backend = new Canvas2DVariantRenderer(this.canvas)
      return true
    }

    const gpu = await WebGPUVariantRenderer.create(this.canvas)
    if (gpu) {
      this.backend = gpu
      return true
    }

    try {
      this.backend = new WebGLVariantRenderer(this.canvas)
      return true
    } catch (e) {
      console.warn('[VariantRenderer] WebGL2 fallback failed:', e)
      try {
        this.backend = new Canvas2DVariantRenderer(this.canvas)
        return true
      } catch (e2) {
        console.warn('[VariantRenderer] Canvas 2D fallback also failed:', e2)
        return false
      }
    }
  }

  uploadRegion(
    regionNumber: number,
    data: {
      regionStart: number
      cellPositions: Uint32Array
      cellRowIndices: Uint32Array
      cellColors: Uint8Array
      cellShapeTypes: Uint8Array
      numCells: number
    },
  ) {
    this.backend?.uploadRegion(regionNumber, data)
  }

  pruneStaleRegions(activeRegionNumbers: number[]) {
    this.backend?.pruneStaleRegions(activeRegionNumbers)
  }

  renderBlocks(
    blocks: VariantRenderBlock[],
    state: {
      canvasWidth: number
      canvasHeight: number
      rowHeight: number
      scrollTop: number
    },
  ) {
    this.backend?.renderBlocks(blocks, state)
  }

  dispose() {
    this.backend?.dispose()
    this.backend = null
    rendererCache.delete(this.canvas)
  }
}
