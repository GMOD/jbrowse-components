import type { FeatureData, GapData } from '../../shared/webglRpcTypes.ts'

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
  regionStart: number,
  regionEnd: number,
  getReadIndex: (featureId: string) => number,
) {
  const skipsByFeature = new Map<string, GapData[]>()
  for (const g of gaps) {
    if (g.type === 'skip') {
      let list = skipsByFeature.get(g.featureId)
      if (!list) {
        list = []
        skipsByFeature.set(g.featureId, list)
      }
      list.push(g)
    }
  }

  let maxSegments = 0
  for (const f of features) {
    const skips = skipsByFeature.get(f.id)
    maxSegments += skips ? skips.length + 1 : 1
  }

  const segmentPositions = new Uint32Array(maxSegments * 2)
  const segmentReadIndices = new Uint32Array(maxSegments)
  const segmentEdgeFlags = new Uint8Array(maxSegments)

  let segIdx = 0
  for (const f of features) {
    const readIdx = getReadIndex(f.id)
    const readStart = Math.max(regionStart, f.start)
    const readEnd = f.end
    const skips = skipsByFeature.get(f.id)

    // Chevron only at the true read start/end, not at region-clipped edges
    const edgeFlags =
      (f.start >= regionStart ? 0b01 : 0) | (f.end <= regionEnd ? 0b10 : 0)

    if (!skips || skips.length === 0) {
      segmentPositions[segIdx * 2] = readStart
      segmentPositions[segIdx * 2 + 1] = readEnd
      segmentReadIndices[segIdx] = readIdx
      segmentEdgeFlags[segIdx] = edgeFlags
      segIdx++
    } else {
      skips.sort((a, b) => a.start - b.start)

      const firstSegIdx = segIdx
      let cur = readStart
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
  }

  const numSegments = segIdx
  return {
    segmentPositions: segmentPositions.slice(0, numSegments * 2),
    segmentReadIndices: segmentReadIndices.slice(0, numSegments),
    segmentEdgeFlags: segmentEdgeFlags.slice(0, numSegments),
    numSegments,
  }
}
