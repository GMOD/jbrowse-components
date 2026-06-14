import { PASS_INDICATOR } from './packGpu.ts'

import type { GpuHal } from '@jbrowse/render-core/hal'

export function uploadIndicators(
  hal: GpuHal,
  displayedRegionIndex: number,
  packedBuffer: ArrayBuffer,
  count: number,
) {
  if (count > 0) {
    hal.uploadBuffer(displayedRegionIndex, PASS_INDICATOR, packedBuffer, count)
  }
}
