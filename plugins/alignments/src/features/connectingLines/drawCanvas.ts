import {
  bpToScreenX,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'

import type { ConnectingLinesUploadData } from './types.ts'
import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawConnectingLines(
  ctx: Ctx2D,
  region: ConnectingLinesUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  // positions stores [start, end] pairs, so line count = length / 2
  const numLines = region.connectingLinePositions.length / 2
  const fH = state.featureHeight

  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.lineWidth = 1

  for (let i = 0; i < numLines; i++) {
    const startBp = region.connectingLinePositions[i * 2]!
    const endBp = region.connectingLinePositions[i * 2 + 1]!
    const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
    const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
    const yRow = region.connectingLineYs[i]!
    const y = pileupRowY(yRow, state) + fH / 2

    ctx.beginPath()
    ctx.moveTo(x1, y)
    ctx.lineTo(x2, y)
    ctx.stroke()
  }
}
