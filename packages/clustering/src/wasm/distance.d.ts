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
  _euclideanDistance: (aPtr: number, bPtr: number, size: number) => number
  _computeDistanceMatrix: (
    dataPtr: number,
    distPtr: number,
    numSamples: number,
    vectorSize: number,
  ) => void
  _averageDistance: (
    setAPtr: number,
    lenA: number,
    setBPtr: number,
    lenB: number,
    distPtr: number,
    numSamples: number,
  ) => number
}

export default function createClusteringModule(): Promise<ClusteringModule>
