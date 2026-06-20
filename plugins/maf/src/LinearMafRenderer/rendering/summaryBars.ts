import { alpha } from '@mui/material'

import type { SummaryBar } from '../../LinearMafDisplay/components/computeVisibleSummaryBars.ts'
import type { MafColorPalette } from '../util.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// `score` here is the UCSC `bigMafSummary` score: a normalized HOXD70 log-odds
// *alignment* score (per-reference-base, squashed into 0..1 by
// hgLoadMafSummary's scorePairwise), NOT a percent identity — high scores read
// as "more conserved/aligned", but the mapping to true identity is nonlinear.
// For an actual percent-identity profile see the conservation band
// (`drawConservation`). Low-score blocks still need to read as "present", so
// map 0..1 onto a floor..1 alpha rather than fading fully transparent.
const MIN_ALPHA = 0.25

export function summaryBarAlpha(score: number) {
  const clamped = Math.max(0, Math.min(1, score))
  return MIN_ALPHA + (1 - MIN_ALPHA) * clamped
}

/**
 * Draw per-species presence bars for the zoom-out summary: one score-shaded
 * rectangle per block on its species' row. Shading bakes a score-proportional
 * alpha into the alignment `matchColor` (the `Ctx2D` SVG path has no
 * `globalAlpha`), so a higher-scoring (more conserved) block reads darker than
 * a divergent one. Mirrors `drawMafEmptyLines`' compositing.
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
