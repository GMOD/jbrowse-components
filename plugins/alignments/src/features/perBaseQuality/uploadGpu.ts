import { PASS_PER_BASE_QUAL, packPerBaseQuality } from './packGpu.ts'

import type { PerBaseQualityUploadData } from './types.ts'
import type { GpuHal } from '@jbrowse/render-core/hal'

export function uploadPerBaseQuality(
  hal: GpuHal,
  displayedRegionIndex: number,
  data: PerBaseQualityUploadData,
) {
  const n = data.perBaseQualPositions.length
  if (n > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_PER_BASE_QUAL,
      packPerBaseQuality(data),
      n,
    )
  }
}
