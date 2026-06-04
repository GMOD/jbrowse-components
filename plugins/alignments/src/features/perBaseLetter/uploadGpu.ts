import { PASS_PER_BASE_LETTER, packPerBaseLetter } from './packGpu.ts'

import type { PerBaseLetterUploadData } from './types.ts'
import type { GpuHal } from '@jbrowse/core/gpu/hal'

export function uploadPerBaseLetter(
  hal: GpuHal,
  displayedRegionIndex: number,
  data: PerBaseLetterUploadData,
) {
  const n = data.perBaseLetterPositions.length
  if (n > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_PER_BASE_LETTER,
      packPerBaseLetter(data),
      n,
    )
  }
}
