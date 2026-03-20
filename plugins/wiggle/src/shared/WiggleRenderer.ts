import { getGpuOverride } from '@jbrowse/core/gpu/getGpuDevice'

import { Canvas2DWiggleRenderer } from './Canvas2DWiggleRenderer.ts'
import { WebGLWiggleRenderer } from './WebGLWiggleRenderer.ts'
import { WebGPUWiggleRenderer } from './WebGPUWiggleRenderer.ts'

import type {
  SourceRenderData,
  WiggleBackend,
  WiggleGPURenderState,
  WiggleRenderBlock,
} from './wiggleBackendTypes.ts'

export type {
  SourceRenderData,
  WiggleBackend,
  WiggleGPURenderState,
  WiggleRenderBlock,
} from './wiggleBackendTypes.ts'

const rendererCache = new WeakMap<HTMLCanvasElement, WiggleRenderer>()

export class WiggleRenderer {
  private canvas: HTMLCanvasElement
  private backend: WiggleBackend | null = null

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static getOrCreate(canvas: HTMLCanvasElement) {
    let renderer = rendererCache.get(canvas)
    if (!renderer) {
      renderer = new WiggleRenderer(canvas)
      rendererCache.set(canvas, renderer)
    }
    return renderer
  }

  async init() {
    if (getGpuOverride() === 'canvas2d') {
      this.backend = new Canvas2DWiggleRenderer(this.canvas)
      return true
    }

    const webgpu = await WebGPUWiggleRenderer.create(this.canvas)
    if (webgpu) {
      this.backend = webgpu
      return true
    }

    try {
      this.backend = new WebGLWiggleRenderer(this.canvas)
      return true
    } catch (e) {
      console.warn('[WiggleRenderer] WebGL2 fallback also failed:', e)
      this.backend = new Canvas2DWiggleRenderer(this.canvas)
      return true
    }
  }

  uploadRegion(
    regionNumber: number,
    regionStart: number,
    sources: SourceRenderData[],
  ) {
    this.backend?.uploadRegion(regionNumber, regionStart, sources)
  }

  pruneRegions(activeRegions: number[]) {
    this.backend?.pruneRegions(activeRegions)
  }

  renderBlocks(blocks: WiggleRenderBlock[], renderState: WiggleGPURenderState) {
    this.backend?.renderBlocks(blocks, renderState)
  }

  dispose() {
    this.backend?.dispose()
    this.backend = null
    rendererCache.delete(this.canvas)
  }
}
