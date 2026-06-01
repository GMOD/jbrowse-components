import { PASS_READ, packReadSegments } from './packGpu.ts'

import type { ReadUploadData } from '../../shared/uploadTypes.ts'
import type { GpuHal } from '@jbrowse/core/gpu/hal'

// Read-pass HAL upload. Stale buffers from a prior sync are cleared by the
// renderer's beginUpload/endUpload bracket, not here, so this only uploads the
// read pass. Caller is responsible for the renderer's per-region metadata cache
// (read positions/Ys/strands), which lives in the renderer because it's also
// touched by the coverage upload step.
export function uploadReads(
  hal: GpuHal,
  displayedRegionIndex: number,
  data: ReadUploadData,
) {
  if (data.numSegments > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_READ,
      packReadSegments(data),
      data.numSegments,
    )
  }
}
