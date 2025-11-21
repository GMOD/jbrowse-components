interface ClusteringModule {
  _malloc: (size: number) => number
  _free: (ptr: number) => void
  ccall: (
    name: string,
    returnType: string | null,
    argTypes: string[],
    args: any[],
  ) => any
  cwrap: (
    name: string,
    returnType: string | null,
    argTypes: string[],
  ) => (...args: any[]) => any
  HEAPF32: Float32Array
  HEAP32: Int32Array
  _hierarchicalCluster: (
    dataPtr: number,
    numSamples: number,
    vectorSize: number,
    outHeights: number,
    outMergeA: number,
    outMergeB: number,
    outOrder: number,
  ) => void
}

export default function createClusteringModule(): Promise<ClusteringModule>
