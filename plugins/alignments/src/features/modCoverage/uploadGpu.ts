import { PASS_MOD_COV } from './packGpu.ts'

import type { ModCoverageUploadData } from '../../shared/uploadTypes.ts'
import type { GpuHal } from '@jbrowse/render-core/hal'

export function uploadModCoverage(
  hal: GpuHal,
  displayedRegionIndex: number,
  data: ModCoverageUploadData,
) {
  const n = data.modCovPositions.length
  if (n > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_MOD_COV,
      data.modCovPackedBuffer,
      n,
    )
  }
}
