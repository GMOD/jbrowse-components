import {
  bpToScreenX,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'

import type { PerBaseQualityUploadData } from './types.ts'
import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// Pre-cached HSL color strings for quality scores 0-255 (matches origin/main
// renderPerBaseQuality: 255 lights up green, lower scores wrap red→yellow).
const qualityColors: string[] = Array.from(
  { length: 256 },
  (_, score) => `hsl(${score === 255 ? 150 : score * 1.5},55%,50%)`,
)

export function drawPerBaseQuality(
  ctx: Ctx2D,
  region: PerBaseQualityUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const n = region.perBaseQualPositions.length
  const fH = state.featureHeight
  const bpPerPx = bpLength / fullBlockWidth
  const w = Math.max(1, 1 / bpPerPx) + 0.5

  for (let i = 0; i < n; i++) {
    const bp = region.perBaseQualPositions[i]!
    const x = bpToScreenX(bp, block, bpLength, fullBlockWidth)
    const yRow = region.perBaseQualYs[i]!
    const y = pileupRowY(yRow, state)
    ctx.fillStyle = qualityColors[region.perBaseQualScores[i]!]!
    ctx.fillRect(x, y, w, fH)
  }
}
