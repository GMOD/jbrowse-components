import { getGpuOverride } from '@jbrowse/core/gpu/getGpuDevice'

import { Canvas2DFeatureRenderer } from './Canvas2DFeatureRenderer.ts'
import { WebGLFeatureRenderer } from './WebGLFeatureRenderer.ts'
import { WebGPUFeatureRenderer } from './WebGPUFeatureRenderer.ts'

import type {
  CanvasFeatureBackend,
  FeatureRenderBlock,
} from './canvasFeatureBackendTypes.ts'

const rendererCache = new WeakMap<HTMLCanvasElement, CanvasFeatureRenderer>()

export class CanvasFeatureRenderer {
  onDeviceLost: (() => void) | null = null

  private canvas: HTMLCanvasElement
  private backend: CanvasFeatureBackend | null = null

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static getOrCreate(canvas: HTMLCanvasElement) {
    let renderer = rendererCache.get(canvas)
    if (!renderer) {
      renderer = new CanvasFeatureRenderer(canvas)
      rendererCache.set(canvas, renderer)
    }
    return renderer
  }

  async init() {
    if (getGpuOverride() === 'canvas2d') {
      this.backend = new Canvas2DFeatureRenderer(this.canvas)
      return true
    }

    const gpuBackend = await WebGPUFeatureRenderer.create(this.canvas)
    if (gpuBackend) {
      gpuBackend.onDeviceLost = () => {
        this.backend = null
        this.onDeviceLost?.()
      }
      this.backend = gpuBackend
      return true
    }

    try {
      this.backend = new WebGLFeatureRenderer(this.canvas)
      return true
    } catch (e) {
      console.warn('[CanvasFeatureRenderer] WebGL2 fallback also failed:', e)
      this.backend = new Canvas2DFeatureRenderer(this.canvas)
      return true
    }
  }

  uploadRegion(
    regionNumber: number,
    data: {
      regionStart: number
      rectPositions: Uint32Array
      rectYs: Float32Array
      rectHeights: Float32Array
      rectColors: Uint8Array
      numRects: number
      linePositions: Uint32Array
      lineYs: Float32Array
      lineColors: Uint8Array
      lineDirections: Int8Array
      numLines: number
      arrowXs: Uint32Array
      arrowYs: Float32Array
      arrowDirections: Int8Array
      arrowHeights: Float32Array
      arrowColors: Uint8Array
      numArrows: number
    },
  ) {
    this.backend?.uploadRegion(regionNumber, data)
  }

  renderBlocks(
    blocks: FeatureRenderBlock[],
    state: { scrollY: number; canvasWidth: number; canvasHeight: number },
  ) {
    this.backend?.renderBlocks(blocks, state)
  }

  pruneStaleRegions(activeRegions: number[]) {
    this.backend?.pruneStaleRegions(activeRegions)
  }

  dispose() {
    this.backend?.dispose()
    this.backend = null
    rendererCache.delete(this.canvas)
  }
}

export { type FeatureRenderBlock } from './canvasFeatureBackendTypes.ts'
