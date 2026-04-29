import { PASS_READ, packReadSegments } from './packGpu.ts'

import type { ReadUploadData } from '../../shared/uploadTypes.ts'
import type { GpuHal } from '@jbrowse/core/gpu/hal'

// Read-pass HAL upload. Caller is responsible for the renderer's per-region
// metadata cache (read positions/Ys/strands) — that lives in the renderer
// because it's also touched by the coverage upload step.
export function uploadReads(
  hal: GpuHal,
  displayedRegionIndex: number,
  data: ReadUploadData,
) {
  hal.deleteRegion(displayedRegionIndex)
  if (data.numSegments > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_READ,
      packReadSegments(data),
      data.numSegments,
    )
  }
}
