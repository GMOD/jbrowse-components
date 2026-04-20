import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'

export type { RenderBlock as VariantRenderBlock } from '@jbrowse/core/gpu/renderBlock'

export interface VariantUploadData {
  regionStart: number
  cellPositions: Uint32Array
  cellRowIndices: Uint32Array
  cellColors: Uint32Array
  cellShapeTypes: Uint8Array
  numCells: number
}

export interface VariantRenderState {
  canvasWidth: number
  canvasHeight: number
  rowHeight: number
  scrollTop: number
}

export interface VariantBackend {
  uploadRegion(displayedRegionIndex: number, data: VariantUploadData): void
  pruneRegions(activeRegions: number[]): void
  renderBlocks(blocks: RenderBlock[], state: VariantRenderState): void
  dispose(): void
}
