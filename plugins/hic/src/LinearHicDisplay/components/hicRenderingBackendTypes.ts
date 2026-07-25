import type { GlobalRenderingBackend } from '@jbrowse/render-core/globalRenderingBackend'

// What painting a bin actually depends on. Kept separate from the canvas dims
// so `drawHicBlocks` can't be handed a mismatched pair — the SVG export draws
// into a layer of its own size and has no canvas to size.
export interface HicDrawState {
  yScalar: number
  colorMaxScore: number
  useLogScale: boolean
  viewScale: number
  viewOffsetX: number
}

export interface HicRenderState extends HicDrawState {
  canvasWidth: number
  canvasHeight: number
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
