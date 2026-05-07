import { PASS_MOD, packModifications } from './packGpu.ts'

import type { ModificationUploadData } from './types.ts'
import type { GpuHal } from '@jbrowse/core/gpu/hal'

export function uploadModifications(
  hal: GpuHal,
  displayedRegionIndex: number,
  data: ModificationUploadData,
) {
  const n = data.modificationPositions.length
  if (n > 0) {
    hal.uploadBuffer(displayedRegionIndex, PASS_MOD, packModifications(data), n)
  }
}
