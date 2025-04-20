// copied from
// https://raw.githubusercontent.com/greenelab/hclust/refs/heads/master/src/hclust.js
// license: MIT

import { checkStopToken } from '@jbrowse/core/util/stopToken'

function toP(n: number) {
  return Number.parseFloat((n * 100).toFixed(1))
}

// get euclidean distance between two equal-dimension vectors
export function euclideanDistance(a: number[], b: number[]) {
  const size = Math.min(a.length, b.length)
  let sum = 0
  for (let index = 0; index < size; index++) {
    sum += (a[index]! - b[index]!) * (a[index]! - b[index]!)
  }
  return Math.sqrt(sum)
}

// get average distance between sets of indexes, given distance matrix
export function averageDistance(
  setA: number[],
  setB: number[],
  distances: number[][],
) {
  let distance = 0
  const lenA = setA.length
  const lenB = setB.length
  for (let i = 0; i < lenA; i++) {
    for (let j = 0; j < lenB; j++) {
      distance += distances[setA[i]!]![setB[j]!]!
    }
  }

  return distance / setA.length / setB.length
}

// the main clustering function
export function clusterData({
  data,
  distance = euclideanDistance,
  linkage = averageDistance,
  onProgress,
  stopToken,
}: {
  data: number[][]
  distance?: (a: number[], b: number[]) => number
  linkage?: (a: number[], b: number[], distances: number[][]) => number
  onProgress?: (a: string) => void
  stopToken?: string
}) {
  // compute distance between each data point and every other data point
  // N x N matrix where N = data.length
  let stopTokenCheckerStart = performance.now()
  let progressStart = performance.now()
  const distances: number[][] = []

  for (let i = 0; i < data.length; i++) {
    const r = performance.now()
    if (r - stopTokenCheckerStart > 400) {
      checkStopToken(stopToken)
      stopTokenCheckerStart = performance.now()
    }
    if (r - progressStart > 50) {
      onProgress?.(`Making distance matrix: ${toP(i / (data.length - 1))}%`)
      progressStart = performance.now()
    }

    // create a row for this data point
    const row: number[] = []

    // calculate distance between this datum and every other datum
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let j = 0; j < data.length; j++) {
      row.push(distance(data[i]!, data[j]!))
    }

    distances.push(row)
  }

  // initialize clusters to match data
  const clusters = data.map((_datum, index) => ({
    height: 0,
    indexes: [Number(index)],
  }))

  // keep track of all tree slices
  let clustersGivenK = []

  stopTokenCheckerStart = performance.now()
  progressStart = performance.now()
  for (let iteration = 0; iteration < data.length; iteration++) {
    const r = performance.now()
    if (r - stopTokenCheckerStart > 400) {
      checkStopToken(stopToken)
      stopTokenCheckerStart = performance.now()
    }
    if (r - progressStart > 50) {
      onProgress?.(`Clustering: ${toP((iteration + 1) / data.length)}%`)
      progressStart = performance.now()
    }

    // add current tree slice
    clustersGivenK.push(clusters.map(cluster => cluster.indexes))

    // dont find clusters to merge when only one cluster left
    if (iteration >= data.length - 1) {
      break
    }

    // initialize smallest distance
    let nearestDistance = Infinity
    let nearestRow = 0
    let nearestCol = 0

    // upper triangular matrix of clusters
    for (let row = 0; row < clusters.length; row++) {
      for (let col = row + 1; col < clusters.length; col++) {
        // calculate distance between clusters
        const distance = linkage(
          clusters[row]!.indexes,
          clusters[col]!.indexes,
          distances,
        )
        // update smallest distance
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearestRow = row
          nearestCol = col
        }
      }
    }

    // merge nearestRow and nearestCol clusters together
    const newCluster = {
      indexes: [
        ...clusters[nearestRow]!.indexes,
        ...clusters[nearestCol]!.indexes,
      ],
      height: nearestDistance,
      children: [clusters[nearestRow], clusters[nearestCol]],
    }

    // remove nearestRow and nearestCol clusters
    // splice higher index first so it doesn't affect second splice
    clusters.splice(Math.max(nearestRow, nearestCol), 1)
    clusters.splice(Math.min(nearestRow, nearestCol), 1)

    // add new merged cluster
    clusters.push(newCluster)
  }

  // assemble full list of tree slices into array where index = k
  clustersGivenK = [[], ...clustersGivenK.reverse()]

  // return useful information
  return {
    clusters: clusters[0],
    distances: distances,
    order: clusters[0]!.indexes,
    clustersGivenK: clustersGivenK,
  }
}
