import {
  bpToScreenX,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import {
  FADE_HI_PX,
  FADE_LO_PX,
  OVERLAP_ALPHA,
} from '../../LinearAlignmentsDisplay/shaders/slang/overlap.iface.generated.ts'

import type { OverlapsUploadData } from './types.ts'
import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// Mild dark tint at full strength; the px-width fade scales it down for narrow
// overlaps so the underlying read color shows through. OVERLAP_ALPHA /
// FADE_LO_PX / FADE_HI_PX come from overlap.generated.ts (overlap.slang is the
// source of truth), so this Canvas2D path can't drift from the shader.

function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

// Mild semi-transparent dark tint over each intra-chain overlap interval,
// matching overlap.slang. Hidden under ~3px rows like the GPU pass, and faded
// out for sub-pixel-narrow overlaps so they vanish when zoomed out.
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
      const startBp = region.overlapPositions[i * 2]!
      const endBp = region.overlapPositions[i * 2 + 1]!
      const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      // reversed (flipped) regions map startBp to the larger screen x, so anchor
      // at the smaller edge and use the absolute width
      const left = Math.min(x1, x2)
      const w = Math.abs(x2 - x1)
      const alpha = OVERLAP_ALPHA * smoothstep(FADE_LO_PX, FADE_HI_PX, w)
      if (w > 0 && alpha > 0) {
        const y = pileupRowY(region.overlapYs[i]!, state)
        ctx.fillStyle = `rgba(0,0,0,${alpha})`
        ctx.fillRect(left, y, w, fH)
      }
    }
  }
}
