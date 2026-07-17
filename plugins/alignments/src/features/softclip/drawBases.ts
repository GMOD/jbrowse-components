import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import {
  makePileupCellMapper,
  pileupRowOffCanvas,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { buildBaseColorTupleMap } from '../mismatch/baseColors.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawSoftclipBases(
  ctx: Ctx2D,
  region: {
    softclipBasePositions: Uint32Array
    softclipBaseYs: Uint16Array
    softclipBaseBases: Uint8Array
  },
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const fH = state.featureHeight
  // Contiguous run of per-base cells (like perBaseLetter), so it takes the seam
  // fudge; without it the Canvas2D fallback showed hairline gaps the GPU didn't.
  const { cellX, w } = makePileupCellMapper(
    block,
    bpLength,
    fullBlockWidth,
    true,
  )
  const baseColors = buildBaseColorTupleMap(state)
  // N has a palette entry; any other non-A/C/G/T byte falls back to the N
  // color, matching the GPU shader (mismatch.slang baseColor catch-all, shared
  // with the softclip-bases overlay) and the mismatch draw. Under
  // showModifications buildBaseColorTupleMap already mutes every base to grey.
  const unknownColor = state.colors.colorBaseN

  for (let i = 0; i < region.softclipBasePositions.length; i++) {
    const yRow = region.softclipBaseYs[i]!
    const y = pileupRowY(yRow, state)
    if (pileupRowOffCanvas(y, state)) {
      continue
    }
    const x = cellX(region.softclipBasePositions[i]!)
    const base = region.softclipBaseBases[i]!
    ctx.fillStyle = rgb255(baseColors[base] ?? unknownColor)
    ctx.fillRect(x, y, w, fH)
  }
}
