import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import {
  bpToScreenX,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'

import type { GapRegionFields } from './buildRegion.ts'
import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

const GAP_DELETION = 0
const GAP_SKIP = 1

export function drawGaps(
  ctx: Ctx2D,
  region: GapRegionFields,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const fH = state.featureHeight

  for (let i = 0; i < region.numGaps; i++) {
    const startBp = region.gapPositions[i * 2]!
    const endBp = region.gapPositions[i * 2 + 1]!
    const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
    const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
    const yRow = region.gapYs[i]!
    const y = pileupRowY(yRow, state)
    const gapType = region.gapTypes[i]!
    const w = Math.max(1, x2 - x1)

    if (gapType === GAP_DELETION) {
      const midY = y + fH / 2
      ctx.fillStyle = rgb255(state.colors.colorDeletion)
      ctx.fillRect(x1, midY - 0.5, w, 1)
    } else if (gapType === GAP_SKIP) {
      ctx.fillStyle = rgb255(state.colors.colorSkip)
      ctx.clearRect(x1, y, w, fH)
      const midY = y + fH / 2
      ctx.fillRect(x1, midY - 0.5, w, 1)
    }
  }
}
