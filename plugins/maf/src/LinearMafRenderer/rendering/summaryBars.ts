import { alpha } from '@mui/material'

import type { SummaryBar } from '../../LinearMafDisplay/components/computeVisibleSummaryBars.ts'
import type { MafColorPalette } from '../util.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// Low-score blocks still need to read as "present", so map score 0..1 onto a
// floor..1 alpha rather than fading fully transparent.
const MIN_ALPHA = 0.25

export function summaryBarAlpha(score: number) {
  const clamped = Math.max(0, Math.min(1, score))
  return MIN_ALPHA + (1 - MIN_ALPHA) * clamped
}

/**
 * Draw per-species presence bars for the zoom-out summary: one score-shaded
 * rectangle per block on its species' row. Shading bakes a score-proportional
 * alpha into the alignment `matchColor` (the `Ctx2D` SVG path has no
 * `globalAlpha`), so a high-identity block reads darker than a divergent one.
 * Mirrors `drawMafEmptyLines`' compositing.
 */
export function drawMafSummaryBars(
  ctx: Ctx2D,
  bars: SummaryBar[],
  palette: MafColorPalette,
) {
  for (const b of bars) {
    ctx.fillStyle = alpha(palette.matchColor, summaryBarAlpha(b.score))
    ctx.fillRect(b.x, b.rowTop, b.width, b.h)
  }
}
