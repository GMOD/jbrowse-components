import { rgb255, rgba255 } from '../LinearAlignmentsDisplay/colorUtils.ts'
import {
  bpToScreenX,
  frequencyFade,
  pileupRowOffCanvas,
  pileupRowY,
} from '../LinearAlignmentsDisplay/renderers/rendererTypes.ts'

import type {
  DrawBlock,
  RenderState,
} from '../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

type ColorTuple = RenderState['colors']['colorSoftclip']

function drawClipBars(
  ctx: Ctx2D,
  positions: Uint32Array,
  ys: Uint16Array,
  frequencies: Uint8Array,
  colorTuple: ColorTuple,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const fH = state.featureHeight
  const pxPerBp = fullBlockWidth / bpLength
  const opaque = rgb255(colorTuple)

  for (let i = 0; i < positions.length; i++) {
    const yRow = ys[i]!
    const y = pileupRowY(yRow, state)
    if (pileupRowOffCanvas(y, state)) {
      continue
    }
    const bp = positions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    // Sub-pixel frequency fade, mirroring clip.slang.
    const alpha = frequencyFade(state, pxPerBp, frequencies[i]!)
    ctx.fillStyle = alpha >= 1 ? opaque : rgba255(colorTuple, alpha)
    ctx.fillRect(x - 0.5, y, 1, fH)
  }
}

export function drawSoftclips(
  ctx: Ctx2D,
  region: {
    softclipPositions: Uint32Array
    softclipYs: Uint16Array
    softclipFrequencies: Uint8Array
  },
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  drawClipBars(
    ctx,
    region.softclipPositions,
    region.softclipYs,
    region.softclipFrequencies,
    state.colors.colorSoftclip,
    block,
    bpLength,
    fullBlockWidth,
    state,
  )
}

export function drawHardclips(
  ctx: Ctx2D,
  region: {
    hardclipPositions: Uint32Array
    hardclipYs: Uint16Array
    hardclipFrequencies: Uint8Array
  },
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  drawClipBars(
    ctx,
    region.hardclipPositions,
    region.hardclipYs,
    region.hardclipFrequencies,
    state.colors.colorHardclip,
    block,
    bpLength,
    fullBlockWidth,
    state,
  )
}
