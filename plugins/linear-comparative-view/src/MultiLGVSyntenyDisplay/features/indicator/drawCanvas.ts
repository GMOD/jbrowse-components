import { drawIndicators } from '@jbrowse/alignments-core'

import type { BlockIndicatorUploadData } from './packGpu.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

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
  drawIndicators(
    ctx,
    region.buffer,
    region.indicatorCount,
    {
      insertion: insertionColor,
      softclip: insertionColor,
      hardclip: insertionColor,
    },
    bpToX,
    viewWidth,
  )
}
