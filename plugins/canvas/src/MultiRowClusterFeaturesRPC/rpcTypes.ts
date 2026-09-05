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
  colorConfig: string | undefined
}

export interface MultiRowClusterFeaturesResult {
  order: number[]
  tree: string
}
