import { drawIndicatorTriangle } from '@jbrowse/alignments-core'

import type { BlockIndicatorUploadData } from './packGpu.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// Synteny indicators have no per-instance color (always insertion), so the
// GPU buffer is a flat Uint32Array of positions (stride 1). Don't route
// through alignments-core's drawIndicators — it expects stride-2 buffers
// with a per-instance colorType field.
export function drawIndicatorCanvas(
  ctx: Ctx2D,
  region: BlockIndicatorUploadData,
  bpToX: (bp: number) => number,
  viewWidth: number,
  insertionColor: string,
) {
  if (region.indicatorCount === 0) {
    return
  }
  const u32 = new Uint32Array(region.buffer)
  ctx.fillStyle = insertionColor
  for (let i = 0; i < region.indicatorCount; i++) {
    const px = bpToX(u32[i]!)
    if (px >= 0 && px < viewWidth) {
      drawIndicatorTriangle(ctx, px)
    }
  }
}
