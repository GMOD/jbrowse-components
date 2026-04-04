import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

import { Canvas2DVariantRenderer } from './Canvas2DVariantRenderer.ts'
import {
  GpuVariantRenderer,
  VARIANT_PASSES,
  VARIANT_UNIFORM_BYTE_SIZE,
} from './GpuVariantRenderer.ts'

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
    this.backend = await initDualBackend<VariantBackend>(
      this.canvas,
      VARIANT_PASSES,
      VARIANT_UNIFORM_BYTE_SIZE,
      hal => new GpuVariantRenderer(hal),
      canvas => new Canvas2DVariantRenderer(canvas),
    )
    return true
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
