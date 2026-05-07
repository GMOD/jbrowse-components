import { packSnpSegmentsForCanvas2D } from '@jbrowse/alignments-core'

import type { CoverageUploadData } from '../../shared/uploadTypes.ts'

// Empty ArrayBuffers must be allocated per-call: the worker transfers them,
// which detaches them. A module-level singleton causes DataCloneError on
// the second RPC reply.

export interface SnpCoverageRegionFields {
  snpBuffer: ArrayBuffer
  snpSegmentCount: number
  snpTotalDepths: Float32Array
}

export function buildSnpCoverageFields(
  data: CoverageUploadData,
): SnpCoverageRegionFields {
  const n = data.snpPositions.length
  if (n === 0) {
    return {
      snpBuffer: new ArrayBuffer(0),
      snpSegmentCount: 0,
      snpTotalDepths: new Float32Array(0),
    }
  }
  const packed = packSnpSegmentsForCanvas2D(
    data.snpPositions,
    data.snpYOffsets,
    data.snpHeights,
    data.snpColorTypes,
    n,
  )
  const snpTotalDepths = new Float32Array(n)
  const { coverageDepths, coverageStartPos } = data
  for (let i = 0; i < n; i++) {
    const idx = data.snpPositions[i]! - coverageStartPos
    snpTotalDepths[i] =
      idx >= 0 && idx < coverageDepths.length ? (coverageDepths[idx] ?? 0) : 0
  }
  return {
    snpBuffer: packed.buffer,
    snpSegmentCount: packed.segmentCount,
    snpTotalDepths,
  }
}

export function emptySnpCoverageFields(): SnpCoverageRegionFields {
  return {
    snpBuffer: new ArrayBuffer(0),
    snpSegmentCount: 0,
    snpTotalDepths: new Float32Array(0),
  }
}
