import {
  bpToScreenX,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'

import type { OverlapsUploadData } from './types.ts'
import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

const STRIPE_PERIOD_PX = 6
const STRIPE_WIDTH_PX = 2

// Diagonal hatch over each intra-chain overlap interval, matching overlap.slang.
// Stripes run at 45° across the overlap rect; clipped to the rect so lines
// don't spill into neighbouring reads. Hidden under ~3px rows like the GPU pass.
export function drawOverlaps(
  ctx: Ctx2D,
  region: OverlapsUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const fH = state.featureHeight
  if (fH < 3) {
    return
  }
  const numOverlaps = region.overlapPositions.length / 2
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'
  ctx.lineWidth = STRIPE_WIDTH_PX
  for (let i = 0; i < numOverlaps; i++) {
    const startBp = region.overlapPositions[i * 2]!
    const endBp = region.overlapPositions[i * 2 + 1]!
    const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
    const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
    const y = pileupRowY(region.overlapYs[i]!, state)
    const w = x2 - x1
    if (w > 0) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(x1, y, w, fH)
      ctx.clip()
      // One diagonal line per period across the rect; offsetting the start by
      // -fH lets a line entering from the top edge cover the rect's left side.
      ctx.beginPath()
      for (let sx = x1 - fH; sx < x2; sx += STRIPE_PERIOD_PX) {
        ctx.moveTo(sx, y + fH)
        ctx.lineTo(sx + fH, y)
      }
      ctx.stroke()
      ctx.restore()
    }
  }
}
