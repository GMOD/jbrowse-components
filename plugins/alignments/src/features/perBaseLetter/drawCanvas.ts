import {
  makePileupCellMapper,
  pileupRowOffCanvas,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { buildBaseCssMap } from '../mismatch/baseColors.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { PerBaseLetterUploadData } from './types.ts'
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
  const { cellX, w } = makePileupCellMapper(
    block,
    bpLength,
    fullBlockWidth,
    true,
  )
  // Same per-base palette as mismatch / softclip-base draws, so the Canvas2D
  // and GPU paths render identical colors (and both mute under modifications).
  // The CSS table bakes in the non-ACGTN fallback, so the byte indexes it
  // directly — one entry per visible base per read runs through this loop.
  const baseCss = buildBaseCssMap(state)

  for (let i = 0; i < n; i++) {
    const yRow = region.perBaseLetterYs[i]!
    const y = pileupRowY(yRow, state)
    if (pileupRowOffCanvas(y, state)) {
      continue
    }
    const x = cellX(region.perBaseLetterPositions[i]!)
    ctx.fillStyle = baseCss[region.perBaseLetterBases[i]!]!
    ctx.fillRect(x, y, w, fH)
  }
}
