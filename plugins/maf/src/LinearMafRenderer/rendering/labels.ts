import { FONT_CONFIG } from './types.ts'

import type { VisibleLabel } from '../../LinearMafDisplay/components/computeVisibleLabels.ts'

export function drawMafLabels(
  ctx: CanvasRenderingContext2D,
  labels: VisibleLabel[],
  contrastForBase: Record<string, string>,
  mismatchRendering: boolean,
) {
  ctx.font = FONT_CONFIG
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  for (const label of labels) {
    ctx.fillStyle = mismatchRendering
      ? (contrastForBase[label.lowerBase] ?? 'black')
      : 'black'
    ctx.fillText(label.text, label.x, label.y)
  }
}
