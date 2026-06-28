import { FONT_CONFIG } from './types.ts'

import type { CodonMarker } from '../../LinearMafDisplay/components/computeVisibleCodons.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export interface CodonColors {
  /** residue matching the reference (conserved) — muted so changes stand out */
  match: string
  /** residue differing from the reference (nonsynonymous) — emphasized */
  differ: string
  /** stop codon */
  stop: string
}

/**
 * Draw per-species amino-acid residues for the codon-translation overlay. Each
 * residue is colored by biology, not base: conserved residues are muted, residues
 * differing from the reference (nonsynonymous) are emphasized, and stops are
 * drawn in the stop color — so the protein-level conservation reads at a glance
 * over the (still visible) nucleotide SNP cells.
 */
export function drawMafCodons(
  ctx: Ctx2D,
  markers: CodonMarker[],
  colors: CodonColors,
) {
  ctx.font = FONT_CONFIG
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  for (const m of markers) {
    ctx.fillStyle =
      m.aa === '*' ? colors.stop : m.differsFromRef ? colors.differ : colors.match
    ctx.fillText(m.aa, m.x, m.y)
  }
}
