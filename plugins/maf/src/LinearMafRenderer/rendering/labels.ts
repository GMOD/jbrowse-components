import { FONT_CONFIG } from './types.ts'

import type { VisibleLabel } from '../../LinearMafDisplay/components/computeVisibleLabels.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawMafLabels(
  ctx: Ctx2D,
  labels: VisibleLabel[],
  contrastForBase: Record<string, string>,
  mismatchRendering: boolean,
) {
  ctx.font = FONT_CONFIG
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  for (const label of labels) {
    ctx.fillStyle = mismatchRendering
      ? (contrastForBase[label.lowerBase] ?? 'black')
      : 'black'
    ctx.fillText(label.text, label.x, label.y)
  }
}
