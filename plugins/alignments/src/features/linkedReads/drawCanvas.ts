import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import {
  bpToScreenX,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'
import { linkedReadColorPalette } from '../../shaders/palettes.ts'

import type { LinkedReadLinesRegionFields } from './buildRegion.ts'
import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawLinkedReadLines(
  ctx: Ctx2D,
  region: LinkedReadLinesRegionFields,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  if (region.numLinkedReadLines === 0) {
    return
  }
  const fH = state.featureHeight
  ctx.lineWidth = 1.5
  for (let i = 0; i < region.numLinkedReadLines; i++) {
    const startBp = region.linkedReadLinePositions[i * 2]!
    const endBp = region.linkedReadLinePositions[i * 2 + 1]!
    const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
    const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
    const y1 = pileupRowY(region.linkedReadLineYs[i * 2]!, state) + fH / 2
    const y2 = pileupRowY(region.linkedReadLineYs[i * 2 + 1]!, state) + fH / 2
    const colorIdx =
      region.linkedReadLineColorTypes[i]! % linkedReadColorPalette.length
    ctx.strokeStyle = rgb255(linkedReadColorPalette[colorIdx]!)
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
}
