import {
  PASS_ARC,
  PASS_ARC_FLAT,
  PASS_ARC_LINE,
  PASS_ARC_MARKER,
  curvedArcCount,
  packArcFlats,
  packArcLines,
  packArcMarkers,
  packArcs,
} from './packGpu.ts'

import type { ArcsUploadData } from './types.ts'
import type { GpuHal } from '@jbrowse/render-core/hal'

// `baseWidth` is the configured `readConnectionsLineWidth`. It reaches the
// upload tier rather than staying a per-frame uniform because each arc's own
// width is resolved at pack time from its read support (see packGpu), which
// makes the setting part of what a buffer was packed from — the renderer's
// upload memo carries it for exactly that reason.
export function uploadArcs(
  hal: GpuHal,
  displayedRegionIndex: number,
  data: ArcsUploadData,
  baseWidth: number,
) {
  // Curved arcs and flat read-cloud connectors are separate passes with very
  // different vertex counts (see packGpu). Read cloud fills the second and
  // leaves the first empty; arc mode does the reverse. `curvedArcCount` is
  // `packArcs`' own — the instance count handed to the HAL has to be the number
  // that packer wrote, not a second subtraction agreeing with it.
  const curvedCount = curvedArcCount(data)
  if (curvedCount > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_ARC,
      packArcs(data, baseWidth),
      curvedCount,
    )
  }
  if (data.numFlatArcs > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_ARC_FLAT,
      packArcFlats(data, baseWidth),
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
      packArcLines(data, baseWidth),
      data.numArcLines,
    )
  }
}
