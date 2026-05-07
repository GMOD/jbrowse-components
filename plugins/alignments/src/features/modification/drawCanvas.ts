import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'

import {
  bpToScreenX,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'

import type { ModificationUploadData } from './types.ts'
import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'
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
  const bpPerPx = bpLength / fullBlockWidth

  for (let i = 0; i < n; i++) {
    const bp = region.modificationPositions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    const w = Math.max(1, 1 / bpPerPx)
    const yRow = region.modificationYs[i]!
    const y = pileupRowY(yRow, state)
    ctx.fillStyle = abgrToCssRgba(region.modificationColors[i]!)
    ctx.fillRect(x, y, w, fH)
  }
}
