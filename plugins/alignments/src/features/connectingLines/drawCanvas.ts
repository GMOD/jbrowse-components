import { rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
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

// NOT a `PileupMark`, declined 2026-09-08 — see
// `agent-docs/ideas/one-mark-declaration-per-feature.md` before starting the
// conversion this file looks ready for. `paintMarks` widens a sub-pixel span
// about its MIDPOINT, and a chain's span starts at `chainAbsMinStarts[i]`, which
// is the minimum over the chain's own reads — so it is an anchored span, and the
// centred pivot would push it half a pixel left of the read that defines its
// edge. The doc has the rest, including the two rule codes it would also need.
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
  // the shader. The colour is `colorConnectingLine` for the same reason the flat
  // read-cloud connector's is: a hairline joining two mates carries no category,
  // so it wants the theme's foreground, and both renderers spelled that as a
  // literal black — which is the background in dark mode.
  ctx.strokeStyle = rgba255(
    state.colors.colorConnectingLine,
    CONNECTING_LINE_ALPHA,
  )
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
