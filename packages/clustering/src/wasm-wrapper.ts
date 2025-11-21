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

export interface ClusteringOptions {
  data: number[][]
  sampleLabels?: string[]
  statusCallback?: (message: string) => void
  checkCancellation?: () => boolean
}

export async function hierarchicalClusterWasm(
  options: ClusteringOptions,
): Promise<ClusteringResult> {
  const { data, sampleLabels, statusCallback, checkCancellation } = options
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

  let callbackPtr: number | null = null

  try {
    // Copy data to WASM
    module.HEAPF32.set(flatData, dataPtr / 4)

    // Set up progress callback if provided
    if (statusCallback || checkCancellation) {
      const progressCallback = (iteration: number, totalIterations: number) => {
        if (checkCancellation?.()) {
          return 0 // Cancel
        }
        if (statusCallback) {
          const progress = Math.round((iteration / totalIterations) * 100)
          statusCallback(
            `Clustering samples: ${progress}% (${iteration}/${totalIterations})`,
          )
        }
        return 1 // Continue
      }

      callbackPtr = module.addFunction(progressCallback, 'iii')
      module._setProgressCallback(callbackPtr)
    }

    // Run clustering in WASM
    const result = module._hierarchicalCluster(
      dataPtr,
      numSamples,
      vectorSize,
      heightsPtr,
      mergeAPtr,
      mergeBPtr,
      orderPtr,
    )

    if (result === -1) {
      throw new Error('Clustering cancelled')
    }

    // Copy results back
    const heights = new Float32Array(numSamples - 1)
    heights.set(
      module.HEAPF32.subarray(heightsPtr / 4, heightsPtr / 4 + numSamples - 1),
    )

    const mergeA = new Int32Array(numSamples - 1)
    mergeA.set(
      module.HEAP32.subarray(mergeAPtr / 4, mergeAPtr / 4 + numSamples - 1),
    )

    const mergeB = new Int32Array(numSamples - 1)
    mergeB.set(
      module.HEAP32.subarray(mergeBPtr / 4, mergeBPtr / 4 + numSamples - 1),
    )

    const order = new Int32Array(numSamples)
    order.set(module.HEAP32.subarray(orderPtr / 4, orderPtr / 4 + numSamples))

    // Rebuild tree structure from merge information
    const tree = rebuildTree(numSamples, heights, mergeA, mergeB, sampleLabels)
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
    // Clean up callback
    if (callbackPtr !== null) {
      module.removeFunction(callbackPtr)
      module._setProgressCallback(0)
    }

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
  sampleLabels?: string[],
): ClusterNode {
  // Create leaf nodes
  const nodes: ClusterNode[] = []
  for (let i = 0; i < numSamples; i++) {
    nodes.push({
      name: sampleLabels?.[i] ?? `Sample ${i}`,
      height: 0,
    })
  }

  // Build tree from merge information
  for (let i = 0; i < numSamples - 1; i++) {
    const leftIdx = mergeA[i]!
    const rightIdx = mergeB[i]!

    const leftNode = nodes[leftIdx]!
    const rightNode = nodes[rightIdx]!

    const newNode: ClusterNode = {
      name: `Cluster ${i}`,
      height: heights[i]!,
      children: [leftNode, rightNode],
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
