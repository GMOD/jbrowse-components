import { getOrCreate } from '../../shared/util.ts'

import type { FeatureData, GapData } from '../../shared/webglRpcTypes.ts'

// Splits each read into per-exon segments at CIGAR skip (N) gaps, at the read's
// true positions; the renderers clip to the block. Edge flags mark the read's
// first and last segment (bit 0, bit 1), where a chevron may cap it.
export function buildSegmentArrays(features: FeatureData[], gaps: GapData[]) {
  // read index is the feature's position in `features` (see extractFeatureArrays)
  const skipsByFeature = new Map<number, GapData[]>()
  let numSkips = 0
  for (const g of gaps) {
    if (g.type === 'skip') {
      getOrCreate(skipsByFeature, g.readIndex, () => []).push(g)
      numSkips++
    }
  }

  // Every read emits at most one more segment than it has skips, so the bucket
  // pass has already counted the bound.
  const maxSegments = features.length + numSkips

  const segmentPositions = new Uint32Array(maxSegments * 2)
  const segmentReadIndices = new Uint32Array(maxSegments)
  const segmentEdgeFlags = new Uint8Array(maxSegments)

  let segIdx = 0
  for (let readIdx = 0; readIdx < features.length; readIdx++) {
    const f = features[readIdx]!
    const readStart = f.start
    const readEnd = f.end
    const skips = skipsByFeature.get(readIdx)

    const firstSegIdx = segIdx
    let cur = readStart
    if (skips) {
      skips.sort((a, b) => a.start - b.start)
      for (const skip of skips) {
        const gapStart = Math.min(readEnd, Math.max(readStart, skip.start))
        const gapEnd = Math.min(readEnd, Math.max(readStart, skip.end))

        // Exon segment before this gap
        if (gapStart > cur) {
          segmentPositions[segIdx * 2] = cur
          segmentPositions[segIdx * 2 + 1] = gapStart
          segmentReadIndices[segIdx] = readIdx
          segIdx++
        }
        if (gapEnd > cur) {
          cur = gapEnd
        }
      }
    }

    // Exon segment after last gap
    if (cur < readEnd) {
      segmentPositions[segIdx * 2] = cur
      segmentPositions[segIdx * 2 + 1] = readEnd
      segmentReadIndices[segIdx] = readIdx
      segIdx++
    }

    if (segIdx > firstSegIdx) {
      segmentEdgeFlags[firstSegIdx] = segmentEdgeFlags[firstSegIdx]! | 0b01
      segmentEdgeFlags[segIdx - 1] = segmentEdgeFlags[segIdx - 1]! | 0b10
    }
  }

  const numSegments = segIdx
  return {
    segmentPositions: segmentPositions.subarray(0, numSegments * 2),
    segmentReadIndices: segmentReadIndices.subarray(0, numSegments),
    segmentEdgeFlags: segmentEdgeFlags.subarray(0, numSegments),
    numSegments,
  }
}
