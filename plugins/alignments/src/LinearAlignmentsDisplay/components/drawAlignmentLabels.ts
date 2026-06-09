import type { VisibleLabel } from './computeVisibleLabels.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { Theme } from '@mui/material'

/**
 * Pure draw function shared by the on-screen `VisibleLabelsOverlay` and the
 * SVG export path. Caller is responsible for sizing/clearing `ctx` and (for
 * raster overlays) applying DPR scaling.
 */
export function drawAlignmentLabels(
  ctx: Ctx2D,
  labels: VisibleLabel[],
  contrastMap: Record<string, string>,
  theme: Theme,
) {
  const { palette } = theme
  const white = palette.common.white
  ctx.textBaseline = 'middle'
  for (const label of labels) {
    const isSmallInterbase =
      ['insertion', 'softclip', 'hardclip'].includes(label.type) &&
      label.text.startsWith('(')

    let fillColor: string
    if (isSmallInterbase) {
      if (label.type === 'insertion') {
        fillColor = palette.insertion
      } else if (label.type === 'softclip') {
        fillColor = palette.softclip
      } else {
        fillColor = palette.hardclip
      }
    } else if (label.type === 'mismatch') {
      fillColor = contrastMap[label.text] ?? 'black'
    } else if (label.type === 'deletion') {
      fillColor = white
    } else {
      fillColor = white
    }

    ctx.font = `bold ${label.fontSize}px sans-serif`
    ctx.textAlign = isSmallInterbase ? 'left' : 'center'
    ctx.fillStyle = fillColor
    ctx.fillText(label.text, label.x, label.y)
  }
}
