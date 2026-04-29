import { packIndicatorsForCanvas2D } from '@jbrowse/alignments-core'

import type { CoverageUploadData } from '../../shared/uploadTypes.ts'

// Empty ArrayBuffers must be allocated per-call: the worker transfers them,
// which detaches them. A module-level singleton causes DataCloneError on
// the second RPC reply.

export interface IndicatorRegionFields {
  indicatorBuffer: ArrayBuffer
  indicatorCount: number
}

export function buildIndicatorFields(
  data: CoverageUploadData,
): IndicatorRegionFields {
  const n = data.indicatorPositions.length
  if (n === 0) {
    return { indicatorBuffer: new ArrayBuffer(0), indicatorCount: 0 }
  }
  const packed = packIndicatorsForCanvas2D(
    data.indicatorPositions,
    data.indicatorColorTypes,
    n,
  )
  return {
    indicatorBuffer: packed.buffer,
    indicatorCount: packed.indicatorCount,
  }
}

export function emptyIndicatorFields(): IndicatorRegionFields {
  return { indicatorBuffer: new ArrayBuffer(0), indicatorCount: 0 }
}
