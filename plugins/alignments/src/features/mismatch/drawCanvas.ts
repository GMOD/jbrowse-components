import { buildBaseColorTupleMap } from './baseColors.ts'
import { rgb255, rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import {
  bpToScreenX,
  frequencyAlpha,
  pileupCellWidth,
  pileupRowOffCanvas,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'

import type { MismatchUploadData } from './types.ts'
import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawMismatches(
  ctx: Ctx2D,
  region: MismatchUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const fH = state.featureHeight
  const bpPerPx = bpLength / fullBlockWidth
  const pxPerBp = fullBlockWidth / bpLength
  const w = pileupCellWidth(bpPerPx, false)
  const baseColors = buildBaseColorTupleMap(state)

  for (let i = 0; i < region.mismatchPositions.length; i++) {
    const bp = region.mismatchPositions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    const yRow = region.mismatchYs[i]!
    const y = pileupRowY(yRow, state)
    if (pileupRowOffCanvas(y, state)) {
      continue
    }
    const base = region.mismatchBases[i]!
    const frequency = region.mismatchFrequencies[i]! / 255
    // N has a palette entry; any other non-A/C/G/T byte falls back to the N
    // color, matching the GPU shader (mismatch.slang baseColor catch-all).
    const colorTuple = baseColors[base] ?? state.colors.colorBaseN
    const freqAlpha =
      state.filterMismatchesByFrequency && pxPerBp < 1
        ? frequencyAlpha(pxPerBp, frequency)
        : 1
    // Fade by base quality: Phred 50+ opaque, lower fades out. qual 0 (no
    // quality) stays opaque. Mirrors the GPU mismatch.slang path.
    const qual = region.mismatchQuals[i]!
    const qualAlpha =
      state.mismatchAlpha && qual > 0 ? Math.min(1, qual / 50) : 1
    const alpha = freqAlpha * qualAlpha
    ctx.fillStyle = alpha >= 1 ? rgb255(colorTuple) : rgba255(colorTuple, alpha)
    ctx.fillRect(x, y, w, fH)
  }
}
