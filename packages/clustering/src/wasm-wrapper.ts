import createClusteringModule from './wasm/distance.js'

type ClusteringModule = Awaited<ReturnType<typeof createClusteringModule>>

let modulePromise: Promise<ClusteringModule> | null = null

async function getModule() {
  if (!modulePromise) {
    modulePromise = createClusteringModule() as Promise<ClusteringModule>
  }
  return modulePromise
}

export async function computeDistanceMatrixWasm(
  data: number[][],
): Promise<Float32Array> {
  const module = await getModule()
  const numSamples = data.length
  const vectorSize = data[0]?.length ?? 0

  const flatData = new Float32Array(numSamples * vectorSize)
  for (let i = 0; i < numSamples; i++) {
    for (let j = 0; j < vectorSize; j++) {
      flatData[i * vectorSize + j] = data[i]![j]!
    }
  }

  const dataBytes = flatData.length * 4
  const distBytes = numSamples * numSamples * 4

  const dataPtr = module._malloc(dataBytes)
  const distPtr = module._malloc(distBytes)

  try {
    module.HEAPF32.set(flatData, dataPtr / 4)

    module._computeDistanceMatrix(dataPtr, distPtr, numSamples, vectorSize)

    const distances = new Float32Array(numSamples * numSamples)
    distances.set(
      module.HEAPF32.subarray(distPtr / 4, distPtr / 4 + numSamples * numSamples),
    )

    return distances
  } finally {
    module._free(dataPtr)
    module._free(distPtr)
  }
}

export async function averageDistanceWasm(
  setA: number[],
  setB: number[],
  distances: Float32Array,
  numSamples: number,
): Promise<number> {
  const module = await getModule()

  const setAInt = new Int32Array(setA)
  const setBInt = new Int32Array(setB)

  const setABytes = setAInt.length * 4
  const setBBytes = setBInt.length * 4
  const distBytes = distances.length * 4

  const setAPtr = module._malloc(setABytes)
  const setBPtr = module._malloc(setBBytes)
  const distPtr = module._malloc(distBytes)

  try {
    module.HEAP32.set(setAInt, setAPtr / 4)
    module.HEAP32.set(setBInt, setBPtr / 4)
    module.HEAPF32.set(distances, distPtr / 4)

    const result = module._averageDistance(
      setAPtr,
      setA.length,
      setBPtr,
      setB.length,
      distPtr,
      numSamples,
    )

    return result
  } finally {
    module._free(setAPtr)
    module._free(setBPtr)
    module._free(distPtr)
  }
}
