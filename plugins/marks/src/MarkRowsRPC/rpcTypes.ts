import type {
  FacetSpec,
  LayerRequest,
  TransformStep,
} from '@jbrowse/core/util/markEncoding'

// No `byteLimit`: the gate stops an incidental viewport fetch, and clustering
// is asked for by name over a locus the reader chose.
export interface MarkRowMatrixArgs {
  adapterConfig: Record<string, unknown>
  regions: {
    refName: string
    start: number
    end: number
    assemblyName: string
  }[]
  // the matrix keys its rows in this order, which `order` indexes back into
  rows: string[]
  // the display's own request less its region, so the split is the one drawn
  transform: TransformStep[]
  facet: FacetSpec
  bpPerPx: number
  // the mark whose values fill each row
  layer: LayerRequest
}

export interface MarkClusterRowsResult {
  order: number[]
  tree: string
}
