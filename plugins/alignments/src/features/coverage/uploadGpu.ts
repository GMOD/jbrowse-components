import { PASS_COVERAGE } from './packGpu.ts'

import type { GpuHal } from '@jbrowse/core/gpu/hal'

export function uploadCoverageBins(
  hal: GpuHal,
  displayedRegionIndex: number,
  packedBuffer: ArrayBuffer,
  binCount: number,
  maxDepth: number,
) {
  if (binCount > 0) {
    hal.uploadBuffer(displayedRegionIndex, PASS_COVERAGE, packedBuffer, binCount)
    hal.setRegionMeta(displayedRegionIndex, { maxDepth })
  }
}
