import { createGpuHal } from '@jbrowse/core/gpu/hal'

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
    const hal = await createGpuHal(
      this.canvas,
      WIGGLE_PASSES,
      WIGGLE_UNIFORM_BYTE_SIZE,
    )
    if (hal) {
      this.backend = new GpuWiggleRenderer(hal)
      return true
    }

    this.backend = new Canvas2DWiggleRenderer(this.canvas)
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
