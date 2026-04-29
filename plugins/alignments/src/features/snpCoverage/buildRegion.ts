import { packSnpSegmentsForCanvas2D } from '@jbrowse/alignments-core'

import type { CoverageUploadData } from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'

// Empty ArrayBuffers must be allocated per-call: the worker transfers them,
// which detaches them. A module-level singleton causes DataCloneError on
// the second RPC reply.

export interface SnpCoverageRegionFields {
  snpBuffer: ArrayBuffer
  snpSegmentCount: number
}

export function buildSnpCoverageFields(
  data: CoverageUploadData,
): SnpCoverageRegionFields {
  const n = data.snpPositions.length
  if (n === 0) {
    return { snpBuffer: new ArrayBuffer(0), snpSegmentCount: 0 }
  }
  const packed = packSnpSegmentsForCanvas2D(
    data.snpPositions,
    data.snpYOffsets,
    data.snpHeights,
    data.snpColorTypes,
    n,
  )
  return { snpBuffer: packed.buffer, snpSegmentCount: packed.segmentCount }
}

export function emptySnpCoverageFields(): SnpCoverageRegionFields {
  return { snpBuffer: new ArrayBuffer(0), snpSegmentCount: 0 }
}
