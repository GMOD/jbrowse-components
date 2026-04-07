import { initDualBackend } from '@jbrowse/core/gpu/createDualRenderer'

import { Canvas2DFeatureRenderer } from './Canvas2DFeatureRenderer.ts'
import {
  CANVAS_FEATURE_PASSES,
  CANVAS_FEATURE_UNIFORM_BYTE_SIZE,
  GpuCanvasFeatureRenderer,
} from './GpuCanvasFeatureRenderer.ts'

import type {
  CanvasFeatureBackend,
  FeatureRenderBlock,
} from './canvasFeatureBackendTypes.ts'
import type { RegionGpuData } from '../../RenderFeatureDataRPC/rpcTypes.ts'

export class CanvasFeatureRenderer {
  onDeviceLost: (() => void) | null = null

  private canvas: HTMLCanvasElement
  private backend: CanvasFeatureBackend | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static getOrCreate(canvas: HTMLCanvasElement) {
    return new CanvasFeatureRenderer(canvas)
  }

  async init() {
    this.backend = await initDualBackend<CanvasFeatureBackend>(
      this.canvas,
      CANVAS_FEATURE_PASSES,
      CANVAS_FEATURE_UNIFORM_BYTE_SIZE,
      hal => new GpuCanvasFeatureRenderer(hal),
      canvas => new Canvas2DFeatureRenderer(canvas),
    )
    return true
  }

  uploadRegion(regionNumber: number, data: RegionGpuData) {
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
  }
}

export { type FeatureRenderBlock } from './canvasFeatureBackendTypes.ts'
