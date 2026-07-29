import { rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import {
  bpToScreenX,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { linkedReadColorPalette } from '../../LinearAlignmentsDisplay/shaders/palettes.ts'
import { LINKED_READ_LINE_ALPHA } from '../../LinearAlignmentsDisplay/shaders/slang/linkedReadLine.iface.generated.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { LinkedReadLinesUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawLinkedReadLines(
  ctx: Ctx2D,
  region: LinkedReadLinesUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const fH = state.featureHeight
  ctx.lineWidth = 1.5
  for (let i = 0; i < region.numLinkedReadLines; i++) {
    const y1 = pileupRowY(region.linkedReadLineYs[i * 2]!, state) + fH / 2
    const y2 = pileupRowY(region.linkedReadLineYs[i * 2 + 1]!, state) + fH / 2
    // A mate pair can straddle the viewport, so unlike the per-row passes the
    // cull has to see both endpoints leave on the same side before it can skip.
    const offCanvas =
      Math.max(y1, y2) < -1 || Math.min(y1, y2) > state.canvasHeight + 1
    if (!offCanvas) {
      const startBp = region.linkedReadLinePositions[i * 2]!
      const endBp = region.linkedReadLinePositions[i * 2 + 1]!
      const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      const colorIdx =
        region.linkedReadLineColorTypes[i]! % linkedReadColorPalette.length
      // LINKED_READ_LINE_ALPHA comes from linkedReadLine.generated.ts
      // (linkedReadLine.slang is the source of truth), so this path can't drift
      // from the shader.
      ctx.strokeStyle = rgba255(
        linkedReadColorPalette[colorIdx]!,
        LINKED_READ_LINE_ALPHA,
      )
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }
  }
}
