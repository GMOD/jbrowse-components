import { packIndicatorsForGpu } from '@jbrowse/alignments-core'

import type { CoverageUploadData } from '../../shared/uploadTypes.ts'

// Empty ArrayBuffers must be allocated per-call: the worker transfers them,
// which detaches them. A module-level singleton causes DataCloneError on
// the second RPC reply.

export interface IndicatorRegionFields {
  indicatorBuffer: ArrayBuffer
}

export function buildIndicatorFields(
  data: CoverageUploadData,
): IndicatorRegionFields {
  return {
    indicatorBuffer: packIndicatorsForGpu(
      data.indicatorPositions,
      data.indicatorColorTypes,
      data.indicatorPositions.length,
    ),
  }
}

export function emptyIndicatorFields(): IndicatorRegionFields {
  return { indicatorBuffer: new ArrayBuffer(0) }
}
