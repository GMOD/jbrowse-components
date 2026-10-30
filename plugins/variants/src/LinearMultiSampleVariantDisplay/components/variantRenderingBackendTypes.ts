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
}

export interface VariantRenderState {
  canvasWidth: number
  canvasHeight: number
  rowHeight: number
  scrollTop: number
  /**
   * The grid rows and cells snap to, in device px per CSS px; the canvas's
   * `backingScale` when unset. The SVG export snaps to 1, so a raster of it at
   * any whole scale lands every row on a pixel.
   */
  snapScale?: number
}

export type VariantRenderingBackend = PerRegionRenderingBackend<
  VariantUploadData,
  VariantRenderState
>
