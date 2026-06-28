import { MIN_HEIGHT_FOR_TEXT } from '@jbrowse/alignments-core'

import { CHAR_SIZE_WIDTH, FONT_CONFIG } from './types.ts'

import type {
  CodonChange,
  CodonMarker,
} from '../../LinearMafDisplay/components/computeVisibleCodons.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export interface CodonColors {
  /** cell fill per change category; `same` is undefined (no fill, stays clean) */
  fill: Record<CodonChange, string | undefined>
  /** amino-acid glyph color */
  text: string
}

/**
 * Draw the codon view: one cell per reference codon per species, filled by how
 * the codon compares to the reference — nonsynonymous changes stand out, silent
 * (synonymous) changes get a faint fill, stops are flagged, and conserved codons
 * stay unfilled. This replaces the per-base SNP cells (the GPU canvas paints
 * nothing in codon mode), so the protein-level change reads cleanly without the
 * nucleotide noise. The amino-acid glyph is drawn on top once the codon cell is
 * wide/tall enough to fit it (two passes to avoid fillStyle thrash).
 */
export function drawMafCodons(
  ctx: Ctx2D,
  markers: CodonMarker[],
  colors: CodonColors,
) {
  for (const m of markers) {
    const fill = colors.fill[m.change]
    if (fill) {
      ctx.fillStyle = fill
      ctx.fillRect(m.xLeft, m.rowTop, m.width, m.h)
    }
  }
  ctx.font = FONT_CONFIG
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillStyle = colors.text
  for (const m of markers) {
    if (
      m.drawGlyph &&
      m.width >= CHAR_SIZE_WIDTH &&
      m.h >= MIN_HEIGHT_FOR_TEXT
    ) {
      ctx.fillText(m.aa, m.x, m.y)
    }
  }
}
