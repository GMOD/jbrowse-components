import { PASS_GAP, packGaps } from './packGpu.ts'

import type { GapUploadData } from './types.ts'
import type { GpuHal } from '@jbrowse/core/gpu/hal'

export function uploadGaps(
  hal: GpuHal,
  displayedRegionIndex: number,
  data: GapUploadData,
) {
  const n = data.gapPositions.length / 2
  if (n > 0) {
    hal.uploadBuffer(displayedRegionIndex, PASS_GAP, packGaps(data), n)
  }
}
