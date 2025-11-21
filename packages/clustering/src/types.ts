export interface ClusterNode {
  indexes: number[]
  height: number
  children?: ClusterNode[]
}

export interface ClusterResult {
  tree: ClusterNode
  distances: Float32Array
  order: number[]
  clustersGivenK: number[][][]
}

export interface ClusterOptions {
  data: number[][]
  onProgress?: (message: string) => void
  stopToken?: string
}
