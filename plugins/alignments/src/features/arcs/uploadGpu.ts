import {
  PASS_ARC,
  PASS_ARC_FLAT,
  PASS_ARC_LINE,
  PASS_ARC_MARKER,
  packArcFlats,
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
  // Curved arcs and flat read-cloud connectors are separate passes with very
  // different vertex counts (see packGpu). Read cloud fills the second and
  // leaves the first empty; arc mode does the reverse.
  const curvedCount = data.numArcs - data.numFlatArcs
  if (curvedCount > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_ARC,
      packArcs(data),
      curvedCount,
    )
  }
  if (data.numFlatArcs > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_ARC_FLAT,
      packArcFlats(data),
      data.numFlatArcs,
    )
  }
  const markerCount = data.numFlatArcs * 2
  if (markerCount > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_ARC_MARKER,
      packArcMarkers(data),
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
