import { PASS_INDICATOR } from './packGpu.ts'

import type { CoverageUploadData } from '../../shared/uploadTypes.ts'
import type { GpuHal } from '@jbrowse/render-core/hal'

export function uploadIndicators(
  hal: GpuHal,
  displayedRegionIndex: number,
  data: CoverageUploadData,
) {
  const n = data.indicatorPositions.length
  if (n > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_INDICATOR,
      data.indicatorPackedBuffer,
      n,
    )
  }
}
