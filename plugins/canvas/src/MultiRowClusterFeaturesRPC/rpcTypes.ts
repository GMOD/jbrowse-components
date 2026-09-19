import type { MatrixEncoding } from './buildMultiRowMatrix.ts'

// Carries no `byteLimit` on purpose: the size gate stops an incidental
// viewport-driven fetch, and clustering is a thing the user asked for by name
// over a locus they chose.
export interface MultiRowClusterFeaturesArgs {
  adapterConfig: Record<string, unknown>
  regions: {
    refName: string
    start: number
    end: number
    assemblyName: string
  }[]
  // the returned `order` indexes back into this row list
  sources: string[]
  partitionField: string
  // '' clusters on presence alone: which bins each row covers
  clusterField: string
}

export interface MultiRowClusterFeaturesResult {
  order: number[]
  tree: string
  // What `clusterField` became in the matrix: a vocabulary past
  // `MAX_CATEGORICAL_VALUES` clusters on presence, and the caption has to say
  // so rather than name the field.
  encoding: MatrixEncoding
}
