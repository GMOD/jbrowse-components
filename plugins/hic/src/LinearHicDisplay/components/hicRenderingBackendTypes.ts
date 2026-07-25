import type { GlobalRenderingBackend } from '@jbrowse/render-core/globalRenderingBackend'

export interface HicRenderState {
  yScalar: number
  canvasWidth: number
  canvasHeight: number
  colorMaxScore: number
  useLogScale: boolean
  viewScale: number
  viewOffsetX: number
}

// `binWidth` rides with the data, not the frame state: it's the px size the
// worker packed `positions` at, so a frame can't scale bins from one payload
// against another's geometry — and it's what keeps `renderState` resolvable
// (a bare getter must never hand back undefined) with no data loaded.
export interface HicUploadData {
  positions: Float32Array
  counts: Float32Array
  numContacts: number
  binWidth: number
}

// HiC adds `uploadColorRamp` for its color-mapped texture; otherwise
// follows the standard monolithic shape (one bulk uploadData, one render).
export interface HicRenderingBackend extends GlobalRenderingBackend<
  HicUploadData,
  HicRenderState
> {
  uploadColorRamp(colors: Uint8Array): void
}
