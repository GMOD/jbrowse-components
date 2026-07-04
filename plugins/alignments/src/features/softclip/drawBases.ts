import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import {
  bpToScreenX,
  pileupCellWidth,
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
  const bpPerPx = bpLength / fullBlockWidth
  // Contiguous run of per-base cells (like perBaseLetter), so it takes the seam
  // fudge; without it the Canvas2D fallback showed hairline gaps the GPU didn't.
  const w = pileupCellWidth(bpPerPx, true)
  const baseColors = buildBaseColorTupleMap(state)
  // Non-A/C/G/T bases (e.g. N) have no palette entry; render them with the
  // muted SNP color rather than dropping them, matching the GPU shader
  // (mismatch.slang, shared with the softclip-bases overlay) and MAF.
  const unknownColor = state.colors.colorMutedSnpBase

  for (let i = 0; i < region.softclipBasePositions.length; i++) {
    const bp = region.softclipBasePositions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    const yRow = region.softclipBaseYs[i]!
    const y = pileupRowY(yRow, state)
    const base = region.softclipBaseBases[i]!
    ctx.fillStyle = rgb255(baseColors[base] ?? unknownColor)
    ctx.fillRect(x, y, w, fH)
  }
}
