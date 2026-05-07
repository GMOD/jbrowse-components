import { drawCoverageBins } from '@jbrowse/alignments-core'

import type { BlockCoverageUploadData } from './packGpu.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// Multi-synteny coverage uses a global max-depth domain (not log/normalized),
// so the score normalizer is identity.
export function drawCoverageCanvas(
  ctx: Ctx2D,
  region: BlockCoverageUploadData,
  bpToX: (bp: number) => number,
  viewWidth: number,
  coverageHeight: number,
  coverageColor: string,
) {
  drawCoverageBins(
    ctx,
    region.buffer,
    (d: number) => d,
    coverageHeight,
    coverageColor,
    bpToX,
    viewWidth,
  )
}
