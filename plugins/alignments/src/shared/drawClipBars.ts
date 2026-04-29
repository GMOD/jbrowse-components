import {
  bpToScreenX,
  pileupRowY,
} from '../LinearAlignmentsDisplay/components/rendererTypes.ts'

import type {
  DrawBlock,
  RenderState,
} from '../LinearAlignmentsDisplay/components/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// Shared Canvas2D helper for soft + hard clip bars. Both feature folders pass
// their region's positions/ys/lengths along with a per-feature color.
export function drawClipBars(
  ctx: Ctx2D,
  positions: Uint32Array,
  ys: Uint16Array,
  lengths: Uint16Array,
  count: number,
  color: string,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  if (count === 0) {
    return
  }
  const fH = state.featureHeight
  const bpPerPx = bpLength / fullBlockWidth

  ctx.fillStyle = color
  for (let i = 0; i < count; i++) {
    const bp = positions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    const yRow = ys[i]!
    const y = pileupRowY(yRow, state)
    const len = lengths[i]!
    const w = Math.max(1, len / bpPerPx)
    ctx.fillRect(x, y, w, fH)
  }
}
