import type { LDDataResult } from '../../RenderLDDataRPC/types.ts'
import type { LDMetric } from '../../VariantRPC/ldTypes.ts'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

// What placing a cell actually depends on. Kept separate from the canvas dims
// so `drawLDBlocks` can't be handed a mismatched pair — the SVG export draws
// into a layer of its own size and has no canvas to size.
export interface LDDrawState {
  yScalar: number
  viewScale: number
  viewOffsetX: number
}

export interface LDRenderState extends LDDrawState {
  canvasWidth: number
  canvasHeight: number
}

// `uniformW` rides with the data, not the frame state: it describes the matrix
// the worker packed, and it is what keeps `renderState` resolvable (a bare
// getter must never hand back undefined) with no data loaded. `metric` rides
// with it for the same reason and one more: it is the metric the file actually
// delivered, which the colour ramp — the mark's `texture` — is built from.
export interface LDUploadData {
  ldValues: Float32Array
  boundaries: Float32Array
  numCells: number
  band: number
  uniformW: number
  metric: LDMetric
  // Present only for genomic positions mode (pre-computed per-cell positions)
  positions?: Float32Array
  cellSizes?: Float32Array
}

export type LDRenderingBackend = PerRegionRenderingBackend<
  LDUploadData,
  LDRenderState
>

// The fetch blob carries more than the backends draw from (hover metadata,
// the SNP list, …), so upload and render share this one narrowing instead of
// each spelling out the field list. The parameter must stay the WIDE type: typed
// `LDUploadData` this was an identity function, and tsc checked nothing — a field
// added to `LDUploadData` and forgotten here would fail at neither end.
export function toLDUploadData(data: LDDataResult): LDUploadData {
  return {
    ldValues: data.ldValues,
    boundaries: data.boundaries,
    numCells: data.numCells,
    band: data.band,
    uniformW: data.uniformW,
    metric: data.metric,
    positions: data.positions,
    cellSizes: data.cellSizes,
  }
}
