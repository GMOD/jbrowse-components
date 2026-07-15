export interface LDRenderState {
  yScalar: number
  canvasWidth: number
  canvasHeight: number
  signedLD: boolean
  viewScale: number
  viewOffsetX: number
  uniformW: number
}

export interface LDUploadData {
  ldValues: Float32Array
  boundaries: Float32Array
  numCells: number
  // Present only for genomic positions mode (pre-computed per-cell positions)
  positions?: Float32Array
  cellSizes?: Float32Array
}

import type { GlobalRenderingBackend } from '@jbrowse/render-core/globalRenderingBackend'

export interface LDRenderingBackend extends GlobalRenderingBackend<
  LDUploadData,
  LDRenderState
> {
  uploadColorRamp(colors: Uint8Array): void
}
