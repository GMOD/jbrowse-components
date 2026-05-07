import { PASS_MISMATCH, packMismatches } from './packGpu.ts'

import type { MismatchUploadData } from './types.ts'
import type { GpuHal } from '@jbrowse/core/gpu/hal'

export function uploadMismatches(
  hal: GpuHal,
  displayedRegionIndex: number,
  data: MismatchUploadData,
) {
  const n = data.mismatchPositions.length
  if (n > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_MISMATCH,
      packMismatches(data),
      n,
    )
  }
}
