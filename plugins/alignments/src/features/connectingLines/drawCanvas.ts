import {
  bpToScreenX,
  pileupRowOffCanvas,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { CONNECTING_LINE_ALPHA } from '../../shaders/slang/connectingLine.consts.generated.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { ConnectingLinesUploadData } from './types.ts'
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

  // CONNECTING_LINE_ALPHA comes from connectingLine.generated.ts
  // (connectingLine.slang is the source of truth), so this path can't drift from
  // the shader.
  ctx.strokeStyle = `rgba(0,0,0,${CONNECTING_LINE_ALPHA})`
  ctx.lineWidth = 1

  for (let i = 0; i < numLines; i++) {
    const rowY = pileupRowY(region.connectingLineYs[i]!, state)
    if (pileupRowOffCanvas(rowY, state)) {
      continue
    }
    const startBp = region.connectingLinePositions[i * 2]!
    const endBp = region.connectingLinePositions[i * 2 + 1]!
    const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
    const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
    // Snap to the same pixel row the shader picks (`floor(center - 0.5)`, then a
    // 1px-tall quad); a centered 1px stroke sits at that row's half-pixel.
    const y = Math.floor(rowY + fH / 2 - 0.5) + 0.5

    ctx.beginPath()
    ctx.moveTo(x1, y)
    ctx.lineTo(x2, y)
    ctx.stroke()
  }
}
