import { drawSnpSegments } from '@jbrowse/alignments-core'

import type { BlockSnpUploadData } from './packGpu.ts'
import type { SyntenyColors } from '../../shared/types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawSnpCoverageCanvas(
  ctx: Ctx2D,
  region: BlockSnpUploadData,
  bpToX: (bp: number) => number,
  viewWidth: number,
  coverageHeight: number,
  colors: SyntenyColors,
) {
  if (region.segmentCount === 0) {
    return
  }
  drawSnpSegments(
    ctx,
    region.buffer,
    region.segmentCount,
    1,
    coverageHeight,
    colors,
    bpToX,
    viewWidth,
  )
}
