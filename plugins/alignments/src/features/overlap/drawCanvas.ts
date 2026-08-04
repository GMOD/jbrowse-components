import {
  bpToScreenX,
  pileupRowOffCanvas,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { overlapAlpha } from '../../LinearAlignmentsDisplay/shaders/slang/overlap.js.generated.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { OverlapsUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// Mild semi-transparent dark tint over each intra-chain overlap interval, so
// the overlapped span darkens the reads underneath rather than blacking them
// out. Hidden under ~3px rows like the GPU pass, and faded out for
// sub-pixel-narrow overlaps so they vanish when zoomed out — `overlapAlpha` is
// overlap.slang's own fade, generated into TS (adr-051), replacing a local
// re-implementation of `smoothstep` applied to the same two constants.
export function drawOverlaps(
  ctx: Ctx2D,
  region: OverlapsUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const fH = state.featureHeight
  if (fH >= 3) {
    const numOverlaps = region.overlapPositions.length / 2
    for (let i = 0; i < numOverlaps; i++) {
      const y = pileupRowY(region.overlapYs[i]!, state)
      if (pileupRowOffCanvas(y, state)) {
        continue
      }
      const startBp = region.overlapPositions[i * 2]!
      const endBp = region.overlapPositions[i * 2 + 1]!
      const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      // reversed (flipped) regions map startBp to the larger screen x, so anchor
      // at the smaller edge and use the absolute width
      const left = Math.min(x1, x2)
      const w = Math.abs(x2 - x1)
      const alpha = overlapAlpha(w)
      if (w > 0 && alpha > 0) {
        ctx.fillStyle = `rgba(0,0,0,${alpha})`
        ctx.fillRect(left, y, w, fH)
      }
    }
  }
}
