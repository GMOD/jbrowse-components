import { LABEL_FONT } from './types.ts'

import type { VisibleLabel } from '../../LinearMafDisplay/components/computeVisibleLabels.ts'
import type { MafLabelColors } from '../util.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

/**
 * Each letter in the color that reads against its cell: the contrast of its
 * base's color, or `neutral` over a match cell.
 */
export function drawMafLabels(
  ctx: Ctx2D,
  labels: VisibleLabel[],
  { forBase, unknownBase, neutral }: MafLabelColors,
) {
  ctx.font = LABEL_FONT.css
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  for (const label of labels) {
    ctx.fillStyle = label.onBase
      ? (forBase[label.lowerBase] ?? unknownBase)
      : neutral
    ctx.fillText(label.text, label.x, label.y)
  }
}
