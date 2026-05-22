import type { MonolithicBackend } from '@jbrowse/core/gpu/monolithicBackend'

export interface HicRenderState {
  binWidth: number
  yScalar: number
  canvasWidth: number
  canvasHeight: number
  colorMaxScore: number
  useLogScale: boolean
  viewScale: number
  viewOffsetX: number
}

export interface HicUploadData {
  positions: Float32Array
  counts: Float32Array
  numContacts: number
}

// HiC adds `uploadColorRamp` for its color-mapped texture; otherwise
// follows the standard monolithic shape (one bulk uploadData, one render).
export interface HicBackend extends MonolithicBackend<
  HicUploadData,
  HicRenderState
> {
  uploadColorRamp(colors: Uint8Array): void
}
