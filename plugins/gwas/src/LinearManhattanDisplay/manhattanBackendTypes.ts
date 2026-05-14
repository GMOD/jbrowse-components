import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'

export interface ManhattanRenderState {
  domainY: [number, number]
  scaleType: number // 0=linear, 1=log
  canvasWidth: number
  canvasHeight: number
  pointRadius: number
}

export interface ManhattanRegionData {
  positions: Uint32Array
  scores: Float32Array
  colors: Uint32Array
  numFeatures: number
}

export interface ManhattanBackend {
  uploadRegion(displayedRegionIndex: number, data: ManhattanRegionData): void
  pruneRegions(activeRegions: number[]): void
  renderBlocks(blocks: RenderBlock[], state: ManhattanRenderState): boolean
  dispose(): void
}
