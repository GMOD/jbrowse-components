import { PASS_LINKED_READ_LINE, packLinkedReadLines } from './packGpu.ts'

import type { LinkedReadLinesUploadData } from './types.ts'
import type { GpuHal } from '@jbrowse/core/gpu/hal'

export function uploadLinkedReadLines(
  hal: GpuHal,
  displayedRegionIndex: number,
  data: LinkedReadLinesUploadData,
) {
  const n = data.numLinkedReadLines ?? 0
  if (n > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_LINKED_READ_LINE,
      packLinkedReadLines(data),
      n,
    )
  }
}
