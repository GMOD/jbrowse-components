import { PASS_ARC, PASS_ARC_LINE, packArcLines, packArcs } from './packGpu.ts'

import type { ArcsUploadData } from './types.ts'
import type { GpuHal } from '@jbrowse/core/gpu/hal'

export function uploadArcs(
  hal: GpuHal,
  displayedRegionIndex: number,
  data: ArcsUploadData,
) {
  if (data.numArcs > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_ARC,
      packArcs(data),
      data.numArcs,
    )
  }
  if (data.numLines > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_ARC_LINE,
      packArcLines(data),
      data.numLines,
    )
  }
}
