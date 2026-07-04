import { qualityCssColors } from './colors.ts'
import {
  bpToScreenX,
  pileupCellWidth,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'

import type { PerBaseQualityUploadData } from './types.ts'
import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawPerBaseQuality(
  ctx: Ctx2D,
  region: PerBaseQualityUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const n = region.perBaseQualPositions.length
  const fH = state.featureHeight
  const bpPerPx = bpLength / fullBlockWidth
  const w = pileupCellWidth(bpPerPx, true)

  for (let i = 0; i < n; i++) {
    const bp = region.perBaseQualPositions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    const yRow = region.perBaseQualYs[i]!
    const y = pileupRowY(yRow, state)
    ctx.fillStyle = qualityCssColors[region.perBaseQualScores[i]!]!
    ctx.fillRect(x, y, w, fH)
  }
}
