import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'

import {
  makePileupCellMapper,
  pileupRowOffCanvas,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { ModificationUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawModifications(
  ctx: Ctx2D,
  region: ModificationUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const n = region.modificationPositions.length
  const fH = state.featureHeight
  const { cellX, w } = makePileupCellMapper(
    block,
    bpLength,
    fullBlockWidth,
    false,
  )

  for (let i = 0; i < n; i++) {
    const yRow = region.modificationYs[i]!
    const y = pileupRowY(yRow, state)
    if (pileupRowOffCanvas(y, state)) {
      continue
    }
    const x = cellX(region.modificationPositions[i]!)
    ctx.fillStyle = abgrToCssRgba(region.modificationColors[i]!)
    ctx.fillRect(x, y, w, fH)
  }
}
