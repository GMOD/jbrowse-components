import { packModCovSegmentsForCanvas2D } from '@jbrowse/alignments-core'

import type { ModCoverageUploadData } from '../../shared/uploadTypes.ts'

// Empty ArrayBuffers must be allocated per-call: the worker transfers them,
// which detaches them. A module-level singleton causes DataCloneError on
// the second RPC reply.

export interface ModCoverageRegionFields {
  modCovBuffer: ArrayBuffer
  modCovSegmentCount: number
}

export function buildModCoverageFields(
  data: ModCoverageUploadData,
): ModCoverageRegionFields {
  const n = data.modCovPositions.length
  if (n === 0) {
    return { modCovBuffer: new ArrayBuffer(0), modCovSegmentCount: 0 }
  }
  const packed = packModCovSegmentsForCanvas2D(
    data.modCovPositions,
    data.modCovYOffsets,
    data.modCovHeights,
    data.modCovColors,
    n,
  )
  return {
    modCovBuffer: packed.buffer,
    modCovSegmentCount: packed.segmentCount,
  }
}

export function emptyModCoverageFields(): ModCoverageRegionFields {
  return { modCovBuffer: new ArrayBuffer(0), modCovSegmentCount: 0 }
}
