import { packModCovSegmentsForGpu } from '@jbrowse/alignments-core'

import type { ModCoverageUploadData } from '../../shared/uploadTypes.ts'

// Empty ArrayBuffers must be allocated per-call: the worker transfers them,
// which detaches them. A module-level singleton causes DataCloneError on
// the second RPC reply.

export interface ModCoverageRegionFields {
  modCovBuffer: ArrayBuffer
}

export function buildModCoverageFields(
  data: ModCoverageUploadData,
): ModCoverageRegionFields {
  return {
    modCovBuffer: packModCovSegmentsForGpu(
      data.modCovPositions,
      data.modCovYOffsets,
      data.modCovHeights,
      data.modCovColors,
      data.modCovRelDepths,
      data.modCovPositions.length,
    ),
  }
}

export function emptyModCoverageFields(): ModCoverageRegionFields {
  return { modCovBuffer: new ArrayBuffer(0) }
}
