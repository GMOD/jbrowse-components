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

// Dark tint over each intra-chain overlap interval, matching overlap.slang.
// Hidden under ~3px rows like the GPU pass.
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
  ctx.fillStyle = '#000'
  for (let i = 0; i < numOverlaps; i++) {
    const startBp = region.overlapPositions[i * 2]!
    const endBp = region.overlapPositions[i * 2 + 1]!
    const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
    const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
    const y = pileupRowY(region.overlapYs[i]!, state)
    const w = x2 - x1
    if (w > 0) {
      ctx.fillRect(x1, y, w, fH)
    }
  }
}
