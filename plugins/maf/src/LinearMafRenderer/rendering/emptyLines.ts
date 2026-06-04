import type { EmptyLineSegment } from '../../LinearMafDisplay/components/computeVisibleEmptyLines.ts'
import type { MafColorPalette } from '../util.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

/**
 * Draw MAF `e`-line (bridged/empty) rows, matching UCSC conventions:
 * - `C` contiguous: a single center line
 * - `I` / `n` intervening bases: a double line
 * - `M` missing data: a pale fill bar
 */
export function drawMafEmptyLines(
  ctx: Ctx2D,
  segments: EmptyLineSegment[],
  palette: MafColorPalette,
) {
  for (const s of segments) {
    if (s.status === 'M') {
      ctx.fillStyle = palette.missingDataColor
      ctx.fillRect(s.x, s.rowTop, s.width, s.h)
    } else {
      ctx.fillStyle = palette.bridgeLineColor
      const mid = Math.round(s.rowTop + s.h / 2)
      if (s.status === 'C') {
        ctx.fillRect(s.x, mid, s.width, 1)
      } else {
        const gap = Math.max(1, Math.min(2, Math.floor(s.h / 4)))
        ctx.fillRect(s.x, mid - gap, s.width, 1)
        ctx.fillRect(s.x, mid + gap, s.width, 1)
      }
    }
  }
}
