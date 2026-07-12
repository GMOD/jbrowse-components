import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import {
  bpToScreenX,
  pileupCellWidth,
  pileupRowOffCanvas,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { buildBaseColorTupleMap } from '../mismatch/baseColors.ts'

import type { PerBaseLetterUploadData } from './types.ts'
import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawPerBaseLetter(
  ctx: Ctx2D,
  region: PerBaseLetterUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const n = region.perBaseLetterPositions.length
  const fH = state.featureHeight
  const bpPerPx = bpLength / fullBlockWidth
  const w = pileupCellWidth(bpPerPx, true)
  // Same per-base palette as mismatch / softclip-base draws, so the Canvas2D
  // and GPU paths render identical colors (and both mute under modifications).
  const baseColors = buildBaseColorTupleMap(state)
  const unknown = state.colors.colorBaseN

  for (let i = 0; i < n; i++) {
    const bp = region.perBaseLetterPositions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    const yRow = region.perBaseLetterYs[i]!
    const y = pileupRowY(yRow, state)
    if (pileupRowOffCanvas(y, state)) {
      continue
    }
    ctx.fillStyle = rgb255(baseColors[region.perBaseLetterBases[i]!] ?? unknown)
    ctx.fillRect(x, y, w, fH)
  }
}
