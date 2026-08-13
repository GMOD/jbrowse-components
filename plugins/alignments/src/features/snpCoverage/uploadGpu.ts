import { PASS_SNP_COV } from './packGpu.ts'

import type { CoverageUploadData } from '../../shared/uploadTypes.ts'
import type { GpuHal } from '@jbrowse/render-core/hal'

export function uploadSnpCoverage(
  hal: GpuHal,
  displayedRegionIndex: number,
  data: CoverageUploadData,
) {
  const n = data.snpPositions.length
  if (n > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_SNP_COV,
      data.snpPackedBuffer,
      n,
    )
  }
}
