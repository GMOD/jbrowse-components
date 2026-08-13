import { PASS_COVERAGE } from './packGpu.ts'

import type { CoverageUploadData } from '../../shared/uploadTypes.ts'
import type { GpuHal } from '@jbrowse/render-core/hal'

export function uploadCoverageBins(
  hal: GpuHal,
  displayedRegionIndex: number,
  data: CoverageUploadData,
) {
  // Not coverageDepths.length — the GPU bars are downsampled to a bin cap, so
  // the buffer's record count is its own field (see CoverageUploadData).
  const n = data.coverageGpuBinCount
  if (n > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_COVERAGE,
      data.coveragePackedBuffer,
      n,
    )
  }
}
