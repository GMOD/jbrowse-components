import {
  makePileupCellMapper,
  pileupRowOffCanvas,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { qualityCssColors } from './colors.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { PerBaseQualityUploadData } from './types.ts'
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
  const { cellX, w } = makePileupCellMapper(
    block,
    bpLength,
    fullBlockWidth,
    true,
  )

  for (let i = 0; i < n; i++) {
    const yRow = region.perBaseQualYs[i]!
    const y = pileupRowY(yRow, state)
    if (pileupRowOffCanvas(y, state)) {
      continue
    }
    const x = cellX(region.perBaseQualPositions[i]!)
    ctx.fillStyle = qualityCssColors[region.perBaseQualScores[i]!]!
    ctx.fillRect(x, y, w, fH)
  }
}
