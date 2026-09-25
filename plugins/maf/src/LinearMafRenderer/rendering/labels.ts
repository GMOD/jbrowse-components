import { LABEL_FONT } from './types.ts'

import type { VisibleLabel } from '../../LinearMafDisplay/components/computeVisibleLabels.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

/**
 * Each letter in the colour that reads against its cell: the contrast of its
 * base's colour, or `neutralText` over a match cell.
 */
export function drawMafLabels(
  ctx: Ctx2D,
  labels: VisibleLabel[],
  contrastForBase: Record<string, string>,
  neutralText: string,
) {
  ctx.font = LABEL_FONT.css
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  for (const label of labels) {
    ctx.fillStyle = label.onBase
      ? (contrastForBase[label.lowerBase] ?? neutralText)
      : neutralText
    ctx.fillText(label.text, label.x, label.y)
  }
}
