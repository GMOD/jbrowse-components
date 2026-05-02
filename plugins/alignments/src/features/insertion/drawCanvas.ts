import { rgb255, rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
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

const LONG_INSERTION_MIN_LENGTH = 10
const INSERTION_SERIF_MIN_PX_PER_BP = 3.0

export function drawInsertions(
  ctx: Ctx2D,
  region: InsertionRegionFields,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const fH = state.featureHeight
  const insColorBase = state.colors.colorInsertion
  const pxPerBp = fullBlockWidth / bpLength

  for (let i = 0; i < region.numInsertions; i++) {
    const bp = region.insertionPositions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    const yRow = region.insertionYs[i]!
    const y = pileupRowY(yRow, state)
    const length = region.insertionLengths[i]!
    const frequency = region.insertionFrequencies[i]! / 255

    const isLong = length >= LONG_INSERTION_MIN_LENGTH
    let alpha = 1.0
    if (!isLong && pxPerBp < 1.0) {
      const base = pxPerBp * pxPerBp
      alpha = base + frequency * (1.0 - base)
    }

    ctx.fillStyle = alpha >= 1.0 ? rgb255(insColorBase) : rgba255(insColorBase, alpha)
    ctx.fillRect(x - 0.5, y, 1, fH)

    const drawSerifs = !isLong && pxPerBp >= INSERTION_SERIF_MIN_PX_PER_BP
    if (drawSerifs) {
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
}
