import type { PerRegionGpuBackend } from '@jbrowse/core/gpu/perRegionBackend'

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

export type VariantBackend = PerRegionGpuBackend<
  VariantUploadData,
  VariantRenderState
>
