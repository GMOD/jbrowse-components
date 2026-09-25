import { LABEL_FONT } from './types.ts'

import type { CodonGlyph } from '../../LinearMafDisplay/codons.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

/** The codon view's amino-acid letters, over the cells the backend painted. */
export function drawMafCodons(
  ctx: Ctx2D,
  glyphs: CodonGlyph[],
  textColor: string,
) {
  ctx.font = LABEL_FONT.css
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillStyle = textColor
  for (const g of glyphs) {
    ctx.fillText(g.aa, g.x, g.y)
  }
}
