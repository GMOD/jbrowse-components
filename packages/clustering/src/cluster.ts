import { computeDistanceMatrixWasm, averageDistanceWasm } from './wasm-wrapper.js'
import type { ClusterNode, ClusterResult, ClusterOptions } from './types.js'

function toP(n: number) {
  return Number.parseFloat((n * 100).toFixed(1))
}

function isWebWorker() {
  return (
    // @ts-expect-error WorkerGlobalScope may not be defined
    typeof WorkerGlobalScope !== 'undefined' &&
    // @ts-expect-error WorkerGlobalScope may not be defined
    self instanceof WorkerGlobalScope
  )
}

function checkStopToken(stopToken: string | undefined) {
  if (typeof jest === 'undefined' && stopToken !== undefined && isWebWorker()) {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', stopToken, false)
    try {
      xhr.send(null)
    } catch (e) {
      throw new Error('aborted')
    }
  }
}

export async function clusterData({
  data,
  onProgress,
  stopToken,
}: ClusterOptions): Promise<ClusterResult> {
  const numSamples = data.length

  onProgress?.('Computing distance matrix with WASM...')
  const distancesFlat = await computeDistanceMatrixWasm(data)

  const clusters: ClusterNode[] = data.map((_datum, index) => ({
    height: 0,
    indexes: [index],
  }))

  const clustersGivenK: number[][][] = []

  let stopTokenCheckerStart = performance.now()
  let progressStart = performance.now()

  for (let iteration = 0; iteration < numSamples; iteration++) {
    const r = performance.now()
    if (r - stopTokenCheckerStart > 400) {
      checkStopToken(stopToken)
      stopTokenCheckerStart = performance.now()
    }
    if (r - progressStart > 50) {
      onProgress?.(`Clustering: ${toP((iteration + 1) / numSamples)}%`)
      progressStart = performance.now()
    }

    clustersGivenK.push(clusters.map(cluster => cluster.indexes))

    if (iteration >= numSamples - 1) {
      break
    }

    let nearestDistance = Infinity
    let nearestRow = 0
    let nearestCol = 0

    for (let row = 0; row < clusters.length; row++) {
      for (let col = row + 1; col < clusters.length; col++) {
        const distance = await averageDistanceWasm(
          clusters[row]!.indexes,
          clusters[col]!.indexes,
          distancesFlat,
          numSamples,
        )

        if (distance < nearestDistance) {
          nearestDistance = distance
          nearestRow = row
          nearestCol = col
        }
      }
    }

    const newCluster: ClusterNode = {
      indexes: [
        ...clusters[nearestRow]!.indexes,
        ...clusters[nearestCol]!.indexes,
      ],
      height: nearestDistance,
      children: [clusters[nearestRow]!, clusters[nearestCol]!],
    }

    clusters.splice(Math.max(nearestRow, nearestCol), 1)
    clusters.splice(Math.min(nearestRow, nearestCol), 1)
    clusters.push(newCluster)
  }

  const fullClustersGivenK = [[], ...clustersGivenK.reverse()]

  return {
    tree: clusters[0]!,
    distances: distancesFlat,
    order: clusters[0]!.indexes,
    clustersGivenK: fullClustersGivenK,
  }
}
