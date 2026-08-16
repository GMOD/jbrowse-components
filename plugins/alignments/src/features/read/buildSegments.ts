import { getOrCreate } from '../../shared/util.ts'

import type { FeatureData, GapData } from '../../shared/webglRpcTypes.ts'
import type { Region } from '@jbrowse/core/util'

// Splits each read into per-exon segments at CIGAR skip (N) gaps.
// Reads without skips produce one segment. Segment starts are clamped
// to regionStart (features starting before regionStart), but ends are NOT
// clipped to regionEnd — the GPU rasterizer handles viewport clipping.
// Positions are absolute genomic uint32 matching readPositions.
// Edge flags encode whether the read's true start/end falls within
// this region (bit 0 = first, bit 1 = last) — used for chevron drawing.
export function buildSegmentArrays(
  features: FeatureData[],
  gaps: GapData[],
  region: Region,
) {
  const { start: regionStart, end: regionEnd } = region
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
    const readStart = Math.max(regionStart, f.start)
    const readEnd = f.end
    const skips = skipsByFeature.get(readIdx)

    // Chevron only at the true read start/end, not at region-clipped edges
    const edgeFlags =
      (f.start >= regionStart ? 0b01 : 0) | (f.end <= regionEnd ? 0b10 : 0)

    const firstSegIdx = segIdx
    let cur = readStart
    // An unspliced read enters neither branch below and falls through to the
    // tail emit, which writes the one whole-read segment a fast path here used
    // to duplicate — and unlike that path emits nothing for a read ending at or
    // before regionStart, rather than an inverted segment.
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

    // Reads entirely intronic in this region produce no segments.
    // Apply edge flags to the outermost segments.
    if (segIdx > firstSegIdx) {
      segmentEdgeFlags[firstSegIdx] =
        segmentEdgeFlags[firstSegIdx]! | (edgeFlags & 0b01)
      segmentEdgeFlags[segIdx - 1] =
        segmentEdgeFlags[segIdx - 1]! | (edgeFlags & 0b10)
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
