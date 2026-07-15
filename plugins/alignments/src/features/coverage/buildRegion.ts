import {
  emptyCanvas2DCoverageBuffer,
  packCoverageBinsCanvas2D,
} from '@jbrowse/alignments-core'

import type { CoverageUploadData } from '../../shared/uploadTypes.ts'
import type { Canvas2DCoverageBuffer } from '@jbrowse/alignments-core'

// coverageMaxDepth is the per-region max depth used for vertical scaling at
// draw time. Carried alongside the buffer because it's needed even when the
// buffer is empty (the y-axis legend uses it).
export interface CoverageRegionFields {
  coverageBuffer: Canvas2DCoverageBuffer
  coverageMaxDepth: number
}

// Pack coverage depth bins into a Canvas2D-friendly buffer once per region.
// Single linear pass over the depths array.
export function buildCoverageFields(
  data: CoverageUploadData,
): CoverageRegionFields {
  const n = data.coverageDepths.length
  if (!(n > 0 && data.coverageMaxDepth > 0)) {
    return { coverageBuffer: emptyCanvas2DCoverageBuffer(), coverageMaxDepth: 0 }
  }
  return {
    coverageBuffer: packCoverageBinsCanvas2D(
      data.coverageDepths,
      data.coverageStartPos,
    ),
    coverageMaxDepth: data.coverageMaxDepth,
  }
}

export function emptyCoverageFields(): CoverageRegionFields {
  return { coverageBuffer: emptyCanvas2DCoverageBuffer(), coverageMaxDepth: 0 }
}
