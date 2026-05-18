import type { VisibleLabel } from './computeVisibleLabels.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

const BASE_CONTRAST: Record<string, string> = {
  A: '#fff',
  C: '#fff',
  G: '#000',
  T: '#fff',
}

/**
 * Pure draw function shared by the on-screen `VisibleLabelsOverlay` and the
 * SVG export path. Mirrors `drawAlignmentLabels` from plugins/alignments.
 */
export function drawSyntenyLabels(
  ctx: Ctx2D,
  labels: VisibleLabel[],
  yOffset = 0,
) {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const label of labels) {
    let fillColor = '#fff'
    if (label.type === 'mismatch' && label.text.length === 1) {
      fillColor = BASE_CONTRAST[label.text] ?? '#fff'
    }
    ctx.font = `bold ${label.fontSize}px monospace`
    ctx.fillStyle = fillColor
    ctx.fillText(label.text, label.x, label.y + yOffset)
  }
}
