import { drawInsertionMarker } from '@jbrowse/alignments-core'

import { rgb255, rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { LONG_INSERTION_MIN_LENGTH } from '../../LinearAlignmentsDisplay/constants.ts'
import {
  bpToScreenX,
  frequencyAlpha,
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
    insertionLengths: Uint16Array
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
    const frequency = region.insertionFrequencies[i]! / 255

    const isLong = length >= LONG_INSERTION_MIN_LENGTH
    const alpha =
      !isLong && state.filterMismatchesByFrequency && pxPerBp < 1
        ? frequencyAlpha(pxPerBp * pxPerBp, frequency)
        : 1

    // Box + serif caps shared with plugin-maf via drawInsertionMarker: a wide
    // labelled box for large insertions, a short bar for long, 1px + serifs for
    // small. Centered on the bp.
    ctx.fillStyle =
      alpha >= 1 ? rgb255(insColorBase) : rgba255(insColorBase, alpha)
    drawInsertionMarker(ctx, x, y, fH, length, pxPerBp)
  }
}
