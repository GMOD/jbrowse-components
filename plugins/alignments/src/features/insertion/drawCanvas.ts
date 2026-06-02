import { rgb255, rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import {
  INSERTION_SERIF_MIN_PX_PER_BP,
  LONG_INSERTION_MIN_LENGTH,
  insertionBarWidth,
} from '../../LinearAlignmentsDisplay/constants.ts'
import {
  bpToScreenX,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawInsertions(
  ctx: Ctx2D,
  region: {
    insertionPositions: Uint32Array
    insertionYs: Uint16Array
    insertionLengths: Uint16Array
    insertionFrequencies: Uint8Array
  },
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const fH = state.featureHeight
  const insColorBase = state.colors.colorInsertion
  const pxPerBp = fullBlockWidth / bpLength

  for (let i = 0; i < region.insertionPositions.length; i++) {
    const bp = region.insertionPositions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    const yRow = region.insertionYs[i]!
    const y = pileupRowY(yRow, state)
    const length = region.insertionLengths[i]!
    const frequency = region.insertionFrequencies[i]! / 255

    const isLong = length >= LONG_INSERTION_MIN_LENGTH
    let alpha = 1
    if (!isLong && pxPerBp < 1) {
      const base = pxPerBp * pxPerBp
      alpha = base + frequency * (1 - base)
    }

    // Same box width as the GPU shader: a wide labelled box for large
    // insertions, a short bar for long, 1px for small. Centered on the bp.
    const w = insertionBarWidth(length, pxPerBp)
    ctx.fillStyle =
      alpha >= 1 ? rgb255(insColorBase) : rgba255(insColorBase, alpha)
    ctx.fillRect(x - w / 2, y, w, fH)

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
