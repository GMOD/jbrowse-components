import {
  LABEL_BASELINE_RATIO,
  LABEL_OVERLAY_BACKGROUND,
  MORE_ISOFORMS_FONT_SCALE,
  renderedTextWidth,
} from '../../RenderFeatureDataRPC/constants.ts'

import type { ResolvedLabel } from './labelPositioning.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

/**
 * Owns `ctx.font` because the isoform badge draws smaller and italic, and only
 * assigns it when the kind changes: a real canvas re-resolves the face on every
 * assignment.
 */
export function paintLabels(
  ctx: Ctx2D,
  labels: ResolvedLabel[],
  fontSize: number,
) {
  const nameFont = `${fontSize}px sans-serif`
  const badgeFont = `italic ${fontSize * MORE_ISOFORMS_FONT_SCALE}px sans-serif`
  let curFont = ''
  const setFont = (font: string) => {
    if (font !== curFont) {
      ctx.font = font
      curFont = font
    }
  }
  for (const resolved of labels) {
    const { label, labelX, labelY } = resolved
    if (resolved.kind === 'more') {
      // An expanded badge reads "show fewer", an instruction to a control no
      // canvas or export carries.
      if (resolved.label.expanded) {
        continue
      }
      setFont(badgeFont)
    } else {
      setFont(nameFont)
      if (resolved.label.isOverlay) {
        ctx.fillStyle = LABEL_OVERLAY_BACKGROUND
        ctx.fillRect(
          labelX - 1,
          labelY,
          renderedTextWidth(label.textWidth, fontSize) + 2,
          fontSize + 1,
        )
      }
    }
    ctx.fillStyle = resolved.color
    // labelY is the label's top, so convert to the baseline fillText wants,
    // off the shared line's size so a smaller badge sits on the name's baseline.
    // An explicit y rather than textBaseline='top', which SvgCanvas maps to
    // dominant-baseline "hanging" and SVG consumers place inconsistently.
    ctx.fillText(
      label.text,
      labelX,
      Math.round(labelY + fontSize * LABEL_BASELINE_RATIO),
    )
  }
}
