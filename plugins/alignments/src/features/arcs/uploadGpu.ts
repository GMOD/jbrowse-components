import {
  PASS_ARC,
  PASS_ARC_LINE,
  PASS_ARC_MARKER,
  packArcLines,
  packArcMarkers,
  packArcs,
} from './packGpu.ts'

import type { ArcsUploadData } from './types.ts'
import type { GpuHal } from '@jbrowse/render-core/hal'

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
  const { buffer: markerBuffer, count: markerCount } = packArcMarkers(data)
  if (markerCount > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_ARC_MARKER,
      markerBuffer,
      markerCount,
    )
  }
  if (data.numArcLines > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_ARC_LINE,
      packArcLines(data),
      data.numArcLines,
    )
  }
}
