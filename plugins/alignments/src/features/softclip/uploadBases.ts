import { PASS_SOFTCLIP_BASES, packSoftclipBases } from './packBases.ts'

import type { CigarUploadData } from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'
import type { GpuHal } from '@jbrowse/core/gpu/hal'

export function uploadSoftclipBases(
  hal: GpuHal,
  displayedRegionIndex: number,
  data: CigarUploadData,
) {
  const n = data.softclipBasePositions.length
  if (n > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_SOFTCLIP_BASES,
      packSoftclipBases(data),
      n,
    )
  }
}
