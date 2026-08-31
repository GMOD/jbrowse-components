// No `byteLimit`, unlike `MultiRowGetFeatures`, so "Cluster rows by similarity"
// will download a region the painting itself refused as too large. Deliberate:
// the gate stops an incidental viewport-driven fetch, and this is a thing the
// user asked for by name over a locus they chose. Stated because the two
// fetches sit side by side and the missing argument reads as an oversight.
export interface MultiRowClusterFeaturesArgs {
  adapterConfig: Record<string, unknown>
  // visible regions to cluster over (renamed to the adapter's refName scheme by
  // RpcMethodTypeWithRenameRegions on the way to the worker)
  regions: {
    refName: string
    start: number
    end: number
    assemblyName: string
  }[]
  // the base row set + order; the returned `order` indexes back into this
  sources: string[]
  // feature attribute whose value assigns each feature to a row
  partitionField: string
  // raw `color` config slot (CSS or `jexl:...`), evaluated per feature to the
  // categorical signal clustered on
  colorConfig: string | undefined
}

export interface MultiRowClusterFeaturesResult {
  order: number[]
  tree: string
}
