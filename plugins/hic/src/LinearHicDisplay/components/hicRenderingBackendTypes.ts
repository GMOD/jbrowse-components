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
// worker packed `instances` at, so a frame can't scale bins from one payload
// against another's geometry — and it's what keeps `renderState` resolvable
// (a bare getter must never hand back undefined) with no data loaded.
//
// `instances` is already the shader's vertex-buffer layout — see
// `HicDataResult.instances` — so the GPU backend hands it to the HAL untouched
// and the Canvas2D/SVG paths read it at stride.
export interface HicUploadData {
  instances: Float32Array
  numContacts: number
  binWidth: number
}

// Two cells: the contact matrix from the fetch, and the colour ramp texture
// from a config slot. `upload` tells them apart by the cell's type, so a
// palette flip re-pushes the ramp alone.
export type HicCellKey = 'data' | 'colorRamp'

export interface HicRenderingBackend extends GlobalRenderingBackend<
  HicUploadData,
  HicRenderState,
  HicCellKey,
  HicUploadData | Uint8Array
> {
  uploadColorRamp(colors: Uint8Array): void
}
