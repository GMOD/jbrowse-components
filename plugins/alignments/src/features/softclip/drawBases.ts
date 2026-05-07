import {
  bpToScreenX,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'
import { buildBaseColorMap } from '../mismatch/baseColors.ts'

import type { SoftclipBaseRegionFields } from './buildRegion.ts'
import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawSoftclipBases(
  ctx: Ctx2D,
  region: SoftclipBaseRegionFields,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  if (region.numSoftclipBases === 0) {
    return
  }
  const fH = state.featureHeight
  const bpPerPx = bpLength / fullBlockWidth
  const baseColors = buildBaseColorMap(state)

  for (let i = 0; i < region.numSoftclipBases; i++) {
    const bp = region.softclipBasePositions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    const w = Math.max(1, 1 / bpPerPx)
    const yRow = region.softclipBaseYs[i]!
    const y = pileupRowY(yRow, state)
    const base = region.softclipBaseBases[i]!
    const color = baseColors[base]
    if (color) {
      ctx.fillStyle = color
      ctx.fillRect(x, y, w, fH)
    }
  }
}
