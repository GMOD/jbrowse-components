import type { GlobalRenderingBackend } from '@jbrowse/render-core/globalRenderingBackend'

export interface LDRenderState {
  yScalar: number
  canvasWidth: number
  canvasHeight: number
  viewScale: number
  viewOffsetX: number
}

// `signedLD` and `uniformW` ride with the data, not the frame state: they
// describe the matrix the worker packed (its metric's sign convention, its
// uniform cell width), so a frame can't color one payload by another's
// convention — and it's what keeps `renderState` resolvable (a bare getter must
// never hand back undefined) with no data loaded.
export interface LDUploadData {
  ldValues: Float32Array
  boundaries: Float32Array
  numCells: number
  signedLD: boolean
  uniformW: number
  // Present only for genomic positions mode (pre-computed per-cell positions)
  positions?: Float32Array
  cellSizes?: Float32Array
}

export interface LDRenderingBackend extends GlobalRenderingBackend<
  LDUploadData,
  LDRenderState
> {
  uploadColorRamp(colors: Uint8Array): void
}

// The fetch blob carries more than the backends draw from (recombination track,
// hover metadata, …), so upload and render share this one narrowing instead of
// each spelling out the field list.
export function toLDUploadData(data: LDUploadData): LDUploadData {
  return {
    ldValues: data.ldValues,
    boundaries: data.boundaries,
    numCells: data.numCells,
    signedLD: data.signedLD,
    uniformW: data.uniformW,
    positions: data.positions,
    cellSizes: data.cellSizes,
  }
}
