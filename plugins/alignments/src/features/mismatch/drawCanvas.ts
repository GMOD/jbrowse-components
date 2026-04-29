import { buildBaseColorMap } from './baseColors.ts'
import {
  bpToScreenX,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'

import type { MismatchRegionFields } from './buildRegion.ts'
import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawMismatches(
  ctx: Ctx2D,
  region: MismatchRegionFields,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const fH = state.featureHeight
  const bpPerPx = bpLength / fullBlockWidth
  const baseColors = buildBaseColorMap(state)

  for (let i = 0; i < region.numMismatches; i++) {
    const bp = region.mismatchPositions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    const w = Math.max(1, 1 / bpPerPx)
    const yRow = region.mismatchYs[i]!
    const y = pileupRowY(yRow, state)
    const base = region.mismatchBases[i]!
    const color = baseColors[base]
    if (color) {
      ctx.fillStyle = color
      ctx.fillRect(x, y, w, fH)
    }
  }
}
