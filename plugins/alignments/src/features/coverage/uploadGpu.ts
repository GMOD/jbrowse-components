import { PASS_COVERAGE } from './packGpu.ts'

import type { GpuHal } from '@jbrowse/render-core/hal'

export function uploadCoverageBins(
  hal: GpuHal,
  displayedRegionIndex: number,
  packedBuffer: ArrayBuffer,
  binCount: number,
) {
  if (binCount > 0) {
    hal.uploadBuffer(displayedRegionIndex, PASS_COVERAGE, packedBuffer, binCount)
  }
}
