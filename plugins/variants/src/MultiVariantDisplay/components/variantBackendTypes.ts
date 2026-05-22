import type { PerRegionBackend } from '@jbrowse/core/gpu/perRegionBackend'

export type { RenderBlock as VariantRenderBlock } from '@jbrowse/core/gpu/renderBlock'

export interface VariantUploadData {
  // Absolute genomic uint32 (start, renderEnd) per cell — shader hp-splits
  // against bpRangeX, so no region origin is shipped alongside.
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

export type VariantBackend = PerRegionBackend<
  VariantUploadData,
  VariantRenderState
>
