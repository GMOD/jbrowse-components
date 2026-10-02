import type { InsertionChannels } from '@jbrowse/alignments-core'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

export type { RenderBlock as VariantRenderBlock } from '@jbrowse/render-core/renderBlock'

export interface VariantUploadData {
  // Absolute genomic uint32 (start, renderEnd) per cell — shader hp-splits
  // against bpRangeX, so no region origin is shipped alongside.
  cellPositions: Uint32Array
  cellRowIndices: Uint32Array
  cellColors: Uint32Array
  cellShapeTypes: Uint8Array
  numCells: number
  // The alt cells of records that insert sequence, widened by the insertion
  // mark; absent while `showInsertionGlyphs` is off.
  insertions?: InsertionChannels
}

export interface VariantRenderState {
  canvasWidth: number
  canvasHeight: number
  rowHeight: number
  scrollTop: number
}

export type VariantRenderingBackend = PerRegionRenderingBackend<
  VariantUploadData,
  VariantRenderState
>
