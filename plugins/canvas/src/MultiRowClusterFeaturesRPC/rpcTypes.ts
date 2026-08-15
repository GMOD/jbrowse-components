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
