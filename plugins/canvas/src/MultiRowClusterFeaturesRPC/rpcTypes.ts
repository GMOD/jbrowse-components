import type { MatrixEncoding } from './buildMultiRowMatrix.ts'

interface RpcRegion {
  refName: string
  start: number
  end: number
  assemblyName: string
}

// Carries no `byteLimit` on purpose: the size gate stops an incidental
// viewport-driven fetch, and clustering or a column sort is a thing the user
// asked for by name over a locus they chose.
export interface MultiRowFeatureValuesArgs {
  adapterConfig: Record<string, unknown>
  regions: RpcRegion[]
  rowsField: string
  // '' reads no attribute: every feature's value is '', so only presence counts
  clusterField: string
}

export interface MultiRowClusterFeaturesArgs extends MultiRowFeatureValuesArgs {
  // the returned `order` indexes back into this row list
  sources: string[]
  // the rows of each band, which cluster apart
  partition?: string[][]
}

export interface MultiRowValuesAtArgs extends MultiRowFeatureValuesArgs {
  pos: number
}

export interface MultiRowClusterFeaturesResult {
  order: number[]
  tree: string
  // What `clusterField` became in the matrix: a vocabulary past
  // `MAX_CATEGORICAL_VALUES` clusters on presence, and the caption has to say
  // so rather than name the field.
  encoding: MatrixEncoding
}
