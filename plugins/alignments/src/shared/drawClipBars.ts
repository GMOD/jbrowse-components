import { rgb255 } from '../LinearAlignmentsDisplay/colorUtils.ts'
import {
  bpToScreenX,
  pileupRowY,
} from '../LinearAlignmentsDisplay/components/rendererTypes.ts'

import type {
  DrawBlock,
  RenderState,
} from '../LinearAlignmentsDisplay/components/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

function drawClipBars(
  ctx: Ctx2D,
  positions: Uint32Array,
  ys: Uint16Array,
  color: string,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const fH = state.featureHeight

  ctx.fillStyle = color
  for (let i = 0; i < positions.length; i++) {
    const bp = positions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    const yRow = ys[i]!
    const y = pileupRowY(yRow, state)
    ctx.fillRect(x - 0.5, y, 1, fH)
  }
}

export function drawSoftclips(
  ctx: Ctx2D,
  region: { softclipPositions: Uint32Array; softclipYs: Uint16Array },
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  drawClipBars(
    ctx,
    region.softclipPositions,
    region.softclipYs,
    rgb255(state.colors.colorSoftclip),
    block,
    bpLength,
    fullBlockWidth,
    state,
  )
}

export function drawHardclips(
  ctx: Ctx2D,
  region: { hardclipPositions: Uint32Array; hardclipYs: Uint16Array },
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  drawClipBars(
    ctx,
    region.hardclipPositions,
    region.hardclipYs,
    rgb255(state.colors.colorHardclip),
    block,
    bpLength,
    fullBlockWidth,
    state,
  )
}
