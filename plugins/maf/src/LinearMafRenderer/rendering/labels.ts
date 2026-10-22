import { LABEL_FONT } from './types.ts'

import type { VisibleLabel } from '../../LinearMafDisplay/components/computeVisibleLabels.ts'
import type { MafLabelColors } from '../util.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

/** Each letter in the contrast of its cell's base color. */
export function drawMafLabels(
  ctx: Ctx2D,
  labels: VisibleLabel[],
  { forBase, unknownBase }: MafLabelColors,
) {
  ctx.font = LABEL_FONT.css
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  for (const label of labels) {
    ctx.fillStyle = forBase[label.lowerBase] ?? unknownBase
    ctx.fillText(label.text, label.x, label.y)
  }
}
