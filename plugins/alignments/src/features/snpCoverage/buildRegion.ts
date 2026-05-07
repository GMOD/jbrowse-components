import { packSnpSegmentsForGpu } from '@jbrowse/alignments-core'

import type { CoverageUploadData } from '../../shared/uploadTypes.ts'

// Empty ArrayBuffers must be allocated per-call: the worker transfers them,
// which detaches them. A module-level singleton causes DataCloneError on
// the second RPC reply.

export interface SnpCoverageRegionFields {
  snpBuffer: ArrayBuffer
}

export function buildSnpCoverageFields(
  data: CoverageUploadData,
): SnpCoverageRegionFields {
  return {
    snpBuffer: packSnpSegmentsForGpu(
      data.snpPositions,
      data.snpYOffsets,
      data.snpHeights,
      data.snpColorTypes,
      data.snpRelDepths,
      data.snpPositions.length,
    ),
  }
}

export function emptySnpCoverageFields(): SnpCoverageRegionFields {
  return { snpBuffer: new ArrayBuffer(0) }
}
