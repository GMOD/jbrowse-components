import createClusteringModule from './distance.js'
import type { ClusterNode } from './types.js'

type ClusteringModule = Awaited<ReturnType<typeof createClusteringModule>>

let moduleInstance: ClusteringModule | null = null

async function getModule() {
  if (!moduleInstance) {
    moduleInstance = await createClusteringModule()
  }
  return moduleInstance
}

export interface ClusteringResult {
  tree: ClusterNode
  order: number[]
  heights: Float32Array
  merges: Array<[number, number]>
}

export async function hierarchicalClusterWasm(
  data: number[][],
): Promise<ClusteringResult> {
  const module = await getModule()
  const numSamples = data.length
  const vectorSize = data[0]?.length ?? 0

  // Flatten data
  const flatData = new Float32Array(numSamples * vectorSize)
  for (let i = 0; i < numSamples; i++) {
    for (let j = 0; j < vectorSize; j++) {
      flatData[i * vectorSize + j] = data[i]![j]!
    }
  }

  // Allocate memory
  const dataPtr = module._malloc(flatData.length * 4)
  const heightsPtr = module._malloc((numSamples - 1) * 4)
  const mergeAPtr = module._malloc((numSamples - 1) * 4)
  const mergeBPtr = module._malloc((numSamples - 1) * 4)
  const orderPtr = module._malloc(numSamples * 4)

  try {
    // Copy data to WASM
    module.HEAPF32.set(flatData, dataPtr / 4)

    // Run clustering in WASM
    module._hierarchicalCluster(
      dataPtr,
      numSamples,
      vectorSize,
      heightsPtr,
      mergeAPtr,
      mergeBPtr,
      orderPtr,
    )

    // Copy results back
    const heights = new Float32Array(numSamples - 1)
    heights.set(module.HEAPF32.subarray(heightsPtr / 4, heightsPtr / 4 + numSamples - 1))

    const mergeA = new Int32Array(numSamples - 1)
    mergeA.set(module.HEAP32.subarray(mergeAPtr / 4, mergeAPtr / 4 + numSamples - 1))

    const mergeB = new Int32Array(numSamples - 1)
    mergeB.set(module.HEAP32.subarray(mergeBPtr / 4, mergeBPtr / 4 + numSamples - 1))

    const order = new Int32Array(numSamples)
    order.set(module.HEAP32.subarray(orderPtr / 4, orderPtr / 4 + numSamples))

    // Rebuild tree structure from merge information
    const tree = rebuildTree(numSamples, heights, mergeA, mergeB)
    const merges: Array<[number, number]> = []
    for (let i = 0; i < numSamples - 1; i++) {
      merges.push([mergeA[i]!, mergeB[i]!])
    }

    return {
      tree,
      order: Array.from(order),
      heights,
      merges,
    }
  } finally {
    module._free(dataPtr)
    module._free(heightsPtr)
    module._free(mergeAPtr)
    module._free(mergeBPtr)
    module._free(orderPtr)
  }
}

function rebuildTree(
  numSamples: number,
  heights: Float32Array,
  mergeA: Int32Array,
  mergeB: Int32Array,
): ClusterNode {
  // Create leaf nodes
  const nodes: ClusterNode[] = []
  for (let i = 0; i < numSamples; i++) {
    nodes.push({
      indexes: [i],
      height: 0,
    })
  }

  // Build tree from merge information
  for (let i = 0; i < numSamples - 1; i++) {
    const leftIdx = mergeA[i]!
    const rightIdx = mergeB[i]!

    const newNode: ClusterNode = {
      indexes: [...nodes[leftIdx]!.indexes, ...nodes[rightIdx]!.indexes],
      height: heights[i]!,
      children: [nodes[leftIdx]!, nodes[rightIdx]!],
    }

    // Replace the merged clusters with the new one
    // Remove higher index first
    const removeFirst = Math.max(leftIdx, rightIdx)
    const removeSecond = Math.min(leftIdx, rightIdx)

    nodes.splice(removeFirst, 1)
    nodes.splice(removeSecond, 1)
    nodes.push(newNode)
  }

  return nodes[0]!
}
