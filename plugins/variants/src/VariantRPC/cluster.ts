// copied from https://raw.githubusercontent.com/greenelab/hclust/refs/heads/master/src/hclust.js
// license: MIT

// get euclidean distance between two equal-dimension vectors
export const euclideanDistance = (a: number[], b: number[]) => {
  const size = Math.min(a.length, b.length)
  let sum = 0
  for (let index = 0; index < size; index++) {
    sum += (a[index]! - b[index]!) * (a[index]! - b[index]!)
  }
  return Math.sqrt(sum)
}

// get average distance between sets of indexes, given distance matrix
export const averageDistance = (
  setA: number[],
  setB: number[],
  distances: number[][],
) => {
  let distance = 0
  for (const a of setA) {
    for (const b of setB) {
      distance += distances[a]![b]!
    }
  }

  return distance / setA.length / setB.length
}

// update progress by calling user onProgress and postMessage for web workers
const updateProgress = (
  stepNumber: number,
  stepProgress: number,
  onProgress: (arg: number) => void,
) => {
  // currently only two distinct steps: computing distance matrix and clustering
  onProgress(stepNumber / 2 + stepProgress / 2)
}

// the main clustering function
export const clusterData = ({
  data,
  distance = euclideanDistance,
  linkage = averageDistance,
  onProgress,
}: {
  data: number[][]
  distance?: (a: number[], b: number[]) => number
  linkage?: (a: number[], b: number[], distances: number[][]) => number
  onProgress?: (a: number) => void
}) => {
  // compute distance between each data point and every other data point
  // N x N matrix where N = data.length
  const distances = data.map((datum, index) => {
    if (onProgress) {
      updateProgress(0, index / (data.length - 1), onProgress)
    }

    // get distance between datum and other datum
    return data.map(otherDatum => distance(datum, otherDatum))
  })

  // initialize clusters to match data
  const clusters = data.map((datum, index) => ({
    height: 0,
    indexes: [Number(index)],
  }))

  // keep track of all tree slices
  let clustersGivenK = []

  // iterate through data
  for (let iteration = 0; iteration < data.length; iteration++) {
    if (onProgress) {
      updateProgress(1, (iteration + 1) / data.length, onProgress)
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
