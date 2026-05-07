import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'

import {
  bpToScreenX,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'

import type { ModificationRegionFields } from './buildRegion.ts'
import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawModifications(
  ctx: Ctx2D,
  region: ModificationRegionFields,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  if (region.numModifications === 0) {
    return
  }
  const fH = state.featureHeight
  const bpPerPx = bpLength / fullBlockWidth

  for (let i = 0; i < region.numModifications; i++) {
    const bp = region.modificationPositions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    const w = Math.max(1, 1 / bpPerPx)
    const yRow = region.modificationYs[i]!
    const y = pileupRowY(yRow, state)
    ctx.fillStyle = abgrToCssRgba(region.modificationColors[i]!)
    ctx.fillRect(x, y, w, fH)
  }
}
