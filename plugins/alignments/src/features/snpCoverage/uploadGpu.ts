import { PASS_SNP_COV } from './packGpu.ts'

import type { GpuHal } from '@jbrowse/core/gpu/hal'

export function uploadSnpCoverage(
  hal: GpuHal,
  displayedRegionIndex: number,
  packedBuffer: ArrayBuffer,
  segmentCount: number,
) {
  if (segmentCount > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_SNP_COV,
      packedBuffer,
      segmentCount,
    )
  }
}
