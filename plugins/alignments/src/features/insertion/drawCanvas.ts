import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import {
  bpToScreenX,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'

import type { InsertionRegionFields } from './buildRegion.ts'
import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawInsertions(
  ctx: Ctx2D,
  region: InsertionRegionFields,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const fH = state.featureHeight
  const insColor = rgb255(state.colors.colorInsertion)

  for (let i = 0; i < region.numInsertions; i++) {
    const bp = region.insertionPositions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    const yRow = region.insertionYs[i]!
    const y = pileupRowY(yRow, state)

    ctx.fillStyle = insColor
    ctx.fillRect(x - 0.5, y, 1, fH)
    ctx.beginPath()
    ctx.moveTo(x - 2, y)
    ctx.lineTo(x + 2, y)
    ctx.lineTo(x, y + 2)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(x - 2, y + fH)
    ctx.lineTo(x + 2, y + fH)
    ctx.lineTo(x, y + fH - 2)
    ctx.closePath()
    ctx.fill()
  }
}
