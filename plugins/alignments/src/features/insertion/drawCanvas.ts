import {
  MIN_VISIBLE_ALPHA,
  drawInsertionMarker,
  insertionSizeAlpha,
} from '@jbrowse/alignments-core'

import { rgb255, rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { LONG_INSERTION_MIN_LENGTH } from '../../LinearAlignmentsDisplay/constants.ts'
import {
  bpToScreenX,
  frequencyFade,
  pileupRowOffCanvas,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawInsertions(
  ctx: Ctx2D,
  region: {
    insertionPositions: Uint32Array
    insertionYs: Uint16Array
    insertionLengths: Uint32Array
    insertionFrequencies: Uint8Array
  },
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const fH = state.featureHeight
  const insColorBase = state.colors.colorInsertion
  const pxPerBp = fullBlockWidth / bpLength

  for (let i = 0; i < region.insertionPositions.length; i++) {
    const yRow = region.insertionYs[i]!
    const y = pileupRowY(yRow, state)
    if (pileupRowOffCanvas(y, state)) {
      continue
    }
    const bp = region.insertionPositions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    const length = region.insertionLengths[i]!

    // Long insertions draw as a fixed marker and never frequency-fade. They do
    // still fade by size — insertionSizeAlpha is the gate for "is this
    // resolvable at this zoom" rather than "is this site rare", and the two
    // multiply. Both are insertion.slang's, imported rather than mirrored.
    const isLong = length >= LONG_INSERTION_MIN_LENGTH
    const alpha =
      (isLong
        ? 1
        : frequencyFade(
            state,
            pxPerBp * pxPerBp,
            region.insertionFrequencies[i]!,
          )) * insertionSizeAlpha(length, pxPerBp)
    if (alpha <= MIN_VISIBLE_ALPHA) {
      continue
    }

    // Box + serif caps shared with plugin-maf via drawInsertionMarker: a wide
    // labelled box for large insertions, a short bar for long, 1px + serifs for
    // small. Centered on the bp.
    ctx.fillStyle =
      alpha >= 1 ? rgb255(insColorBase) : rgba255(insColorBase, alpha)
    drawInsertionMarker(ctx, x, y, fH, length, pxPerBp)
  }
}
