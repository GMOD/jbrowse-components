import { PASS_OVERLAP, packOverlaps } from './packGpu.ts'

import type { OverlapsUploadData } from './types.ts'
import type { GpuHal } from '@jbrowse/core/gpu/hal'

export function uploadOverlaps(
  hal: GpuHal,
  displayedRegionIndex: number,
  data: OverlapsUploadData,
) {
  const n = data.overlapPositions.length / 2
  if (n > 0) {
    hal.uploadBuffer(displayedRegionIndex, PASS_OVERLAP, packOverlaps(data), n)
  }
}
