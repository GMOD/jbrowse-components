import { PASS_NONCOV } from './packGpu.ts'

import type { GpuHal } from '@jbrowse/core/gpu/hal'

export function uploadNoncov(
  hal: GpuHal,
  displayedRegionIndex: number,
  packedBuffer: ArrayBuffer,
  segmentCount: number,
) {
  if (segmentCount > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_NONCOV,
      packedBuffer,
      segmentCount,
    )
  }
}
