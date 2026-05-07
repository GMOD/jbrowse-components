import { rgb255, rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import {
  bpToScreenX,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'

import type { MismatchUploadData } from './types.ts'
import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// Returns raw RGBColor tuples (not CSS strings) so that drawMismatches can
// apply per-mismatch alpha via rgba255() without reparsing. See
// buildBaseColorMap in baseColors.ts for the CSS-string variant used by
// features that don't need alpha blending.
function buildMismatchColorTupleMap(
  state: RenderState,
): Record<number, [number, number, number]> {
  const { colors } = state
  const mutedBase = colors.colorMutedSnpBase
  return state.showModifications
    ? { 65: mutedBase, 67: mutedBase, 71: mutedBase, 84: mutedBase }
    : {
        65: colors.colorBaseA,
        67: colors.colorBaseC,
        71: colors.colorBaseG,
        84: colors.colorBaseT,
      }
}

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
  const pxPerBp = 1 / bpPerPx
  const baseColors = buildMismatchColorTupleMap(state)

  for (let i = 0; i < region.mismatchPositions.length; i++) {
    const bp = region.mismatchPositions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    const w = Math.max(1, 1 / bpPerPx)
    const yRow = region.mismatchYs[i]!
    const y = pileupRowY(yRow, state)
    const base = region.mismatchBases[i]!
    const frequency = region.mismatchFrequencies[i]! / 255
    const colorTuple = baseColors[base]
    if (colorTuple) {
      let alpha = 1
      if (pxPerBp < 1) {
        alpha = pxPerBp + frequency * (1 - pxPerBp)
      }
      ctx.fillStyle =
        alpha >= 1 ? rgb255(colorTuple) : rgba255(colorTuple, alpha)
      ctx.fillRect(x, y, w, fH)
    }
  }
}
