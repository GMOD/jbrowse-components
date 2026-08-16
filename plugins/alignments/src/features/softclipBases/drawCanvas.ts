import {
  makePileupCellMapper,
  pileupRowOffCanvas,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { buildBaseCssMap } from '../mismatch/baseColors.ts'

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
  // N has a palette entry; any other non-A/C/G/T byte takes the table's
  // pre-filled fallback, matching the GPU shader (mismatch.slang baseColor
  // catch-all, shared with the softclip-bases overlay) and the mismatch draw —
  // including its mute under showModifications.
  const baseCss = buildBaseCssMap(state)

  for (let i = 0; i < region.softclipBasePositions.length; i++) {
    const yRow = region.softclipBaseYs[i]!
    const y = pileupRowY(yRow, state)
    if (pileupRowOffCanvas(y, state)) {
      continue
    }
    const x = cellX(region.softclipBasePositions[i]!)
    ctx.fillStyle = baseCss[region.softclipBaseBases[i]!]!
    ctx.fillRect(x, y, w, fH)
  }
}
