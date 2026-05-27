import { PASS_INTERBASE } from './packGpu.ts'

import type { GpuHal } from '@jbrowse/core/gpu/hal'

export function uploadInterbase(
  hal: GpuHal,
  displayedRegionIndex: number,
  packedBuffer: ArrayBuffer,
  segmentCount: number,
) {
  if (segmentCount > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_INTERBASE,
      packedBuffer,
      segmentCount,
    )
  }
}
