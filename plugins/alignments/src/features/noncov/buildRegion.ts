import { packNoncovSegmentsForCanvas2D } from '@jbrowse/alignments-core'

import type { CoverageUploadData } from '../../shared/uploadTypes.ts'

// Empty ArrayBuffers must be allocated per-call: the worker transfers them,
// which detaches them. A module-level singleton causes DataCloneError on
// the second RPC reply.

export interface NoncovRegionFields {
  noncovBuffer: ArrayBuffer
  noncovSegmentCount: number
  noncovMaxCount: number
}

export function buildNoncovFields(data: CoverageUploadData): NoncovRegionFields {
  const n = data.noncovPositions.length
  if (n === 0) {
    return { noncovBuffer: new ArrayBuffer(0), noncovSegmentCount: 0, noncovMaxCount: 0 }
  }
  const packed = packNoncovSegmentsForCanvas2D(
    data.noncovPositions,
    data.noncovYOffsets,
    data.noncovHeights,
    data.noncovColorTypes,
    n,
  )
  return {
    noncovBuffer: packed.buffer,
    noncovSegmentCount: packed.segmentCount,
    noncovMaxCount: data.noncovMaxCount,
  }
}

export function emptyNoncovFields(): NoncovRegionFields {
  return { noncovBuffer: new ArrayBuffer(0), noncovSegmentCount: 0, noncovMaxCount: 0 }
}
