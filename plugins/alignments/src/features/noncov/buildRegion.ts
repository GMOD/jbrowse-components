import { packNoncovSegmentsForGpu } from '@jbrowse/alignments-core'

import type { CoverageUploadData } from '../../shared/uploadTypes.ts'

// Empty ArrayBuffers must be allocated per-call: the worker transfers them,
// which detaches them. A module-level singleton causes DataCloneError on
// the second RPC reply.

// noncovMaxCount is needed for vertical scaling at draw time (peaks scale
// linearly to the max), so it must be carried separately from the buffer.
export interface NoncovRegionFields {
  noncovBuffer: ArrayBuffer
  noncovMaxCount: number
}

export function buildNoncovFields(
  data: CoverageUploadData,
): NoncovRegionFields {
  return {
    noncovBuffer: packNoncovSegmentsForGpu(
      data.noncovPositions,
      data.noncovYOffsets,
      data.noncovHeights,
      data.noncovColorTypes,
      data.noncovPositions.length,
    ),
    noncovMaxCount: data.noncovMaxCount,
  }
}

export function emptyNoncovFields(): NoncovRegionFields {
  return { noncovBuffer: new ArrayBuffer(0), noncovMaxCount: 0 }
}
