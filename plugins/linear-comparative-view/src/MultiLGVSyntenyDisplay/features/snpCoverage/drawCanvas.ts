import { drawSnpSegments } from '@jbrowse/alignments-core'

import type { BlockSnpUploadData } from './packGpu.ts'
import type { SyntenyColors } from '../../shared/types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// Synteny shares alignments' drawSnpSegments because multiSyntenySnp.slang's
// Instance struct is identical to snpCoverage.slang (same 5 attrs in the same
// order). If they ever diverge, fork this into a synteny-local draw fn — the
// codegen won't catch the mismatch (each shader's layout file is correct on its
// own, but the draw fn would walk synteny's buffer with alignments' stride).
export function drawSnpCoverageCanvas(
  ctx: Ctx2D,
  region: BlockSnpUploadData,
  bpToX: (bp: number) => number,
  viewWidth: number,
  coverageHeight: number,
  colors: SyntenyColors,
) {
  drawSnpSegments(
    ctx,
    region.buffer,
    (d: number) => d,
    1,
    coverageHeight,
    colors,
    bpToX,
    viewWidth,
  )
}
