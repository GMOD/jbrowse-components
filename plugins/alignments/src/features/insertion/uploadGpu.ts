import { PASS_INSERTION, packInsertions } from './packGpu.ts'

import type { CigarUploadData } from '../../shared/uploadTypes.ts'
import type { GpuHal } from '@jbrowse/core/gpu/hal'

export function uploadInsertions(
  hal: GpuHal,
  displayedRegionIndex: number,
  data: CigarUploadData,
) {
  const n = data.numInsertions
  if (n > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_INSERTION,
      packInsertions(data),
      n,
    )
  }
}
