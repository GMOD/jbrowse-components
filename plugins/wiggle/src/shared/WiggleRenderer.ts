import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

import { Canvas2DWiggleRenderer } from './Canvas2DWiggleRenderer.ts'
import {
  GpuWiggleRenderer,
  WIGGLE_PASSES,
  WIGGLE_UNIFORM_BYTE_SIZE,
} from './GpuWiggleRenderer.ts'

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
    this.backend = await initDualBackend<WiggleBackend>(
      this.canvas,
      WIGGLE_PASSES,
      WIGGLE_UNIFORM_BYTE_SIZE,
      hal => new GpuWiggleRenderer(hal),
      canvas => new Canvas2DWiggleRenderer(canvas),
    )
    return true
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
