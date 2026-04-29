import { PASS_MOD_COV } from './packGpu.ts'

import type { GpuHal } from '@jbrowse/core/gpu/hal'

export function uploadModCoverage(
  hal: GpuHal,
  displayedRegionIndex: number,
  packedBuffer: ArrayBuffer,
  segmentCount: number,
) {
  if (segmentCount > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_MOD_COV,
      packedBuffer,
      segmentCount,
    )
  }
}
