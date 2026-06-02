import { buildBaseColorTupleMap } from './baseColors.ts'
import { rgb255, rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import {
  bpToScreenX,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'

import type { MismatchUploadData } from './types.ts'
import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawMismatches(
  ctx: Ctx2D,
  region: MismatchUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const fH = state.featureHeight
  const bpPerPx = bpLength / fullBlockWidth
  const pxPerBp = fullBlockWidth / bpLength
  const baseColors = buildBaseColorTupleMap(state)

  for (let i = 0; i < region.mismatchPositions.length; i++) {
    const bp = region.mismatchPositions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    const w = Math.max(1, 1 / bpPerPx)
    const yRow = region.mismatchYs[i]!
    const y = pileupRowY(yRow, state)
    const base = region.mismatchBases[i]!
    const frequency = region.mismatchFrequencies[i]! / 255
    // N has a palette entry; any other non-A/C/G/T byte falls back to the N
    // color, matching the GPU shader (mismatch.slang baseColor catch-all).
    const colorTuple = baseColors[base] ?? state.colors.colorBaseN
    let alpha = 1
    if (pxPerBp < 1) {
      alpha = pxPerBp + frequency * (1 - pxPerBp)
    }
    ctx.fillStyle = alpha >= 1 ? rgb255(colorTuple) : rgba255(colorTuple, alpha)
    ctx.fillRect(x, y, w, fH)
  }
}
