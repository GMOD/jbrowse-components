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

export class WiggleRenderer {
  private canvas: HTMLCanvasElement
  private backend: WiggleBackend | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static getOrCreate(canvas: HTMLCanvasElement) {
    return new WiggleRenderer(canvas)
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
  }
}
