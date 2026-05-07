import { PASS_CONN_LINE, packConnectingLines } from './packGpu.ts'

import type { ConnectingLinesUploadData } from './types.ts'
import type { GpuHal } from '@jbrowse/core/gpu/hal'

export function uploadConnectingLines(
  hal: GpuHal,
  displayedRegionIndex: number,
  data: ConnectingLinesUploadData,
) {
  const n = data.connectingLinePositions.length / 2
  if (n > 0) {
    hal.uploadBuffer(
      displayedRegionIndex,
      PASS_CONN_LINE,
      packConnectingLines(data),
      n,
    )
  }
}
