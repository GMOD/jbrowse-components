import { drawInsertionMarker } from '@jbrowse/alignments-core'

import { rgb255, rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { LONG_INSERTION_MIN_LENGTH } from '../../LinearAlignmentsDisplay/constants.ts'
import {
  bpToScreenX,
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
    const bp = region.insertionPositions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    const yRow = region.insertionYs[i]!
    const y = pileupRowY(yRow, state)
    const length = region.insertionLengths[i]!
    const frequency = region.insertionFrequencies[i]! / 255

    const isLong = length >= LONG_INSERTION_MIN_LENGTH
    let alpha = 1
    if (!isLong && state.filterMismatchesByFrequency && pxPerBp < 1) {
      const base = pxPerBp * pxPerBp
      alpha = base + frequency * (1 - base)
    }

    // Box + serif caps shared with plugin-maf via drawInsertionMarker: a wide
    // labelled box for large insertions, a short bar for long, 1px + serifs for
    // small. Centered on the bp.
    ctx.fillStyle =
      alpha >= 1 ? rgb255(insColorBase) : rgba255(insColorBase, alpha)
    drawInsertionMarker(ctx, x, y, fH, length, pxPerBp)
  }
}
