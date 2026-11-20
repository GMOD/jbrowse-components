import { measureText } from '@jbrowse/core/util'

import {
  LABEL_BASELINE_RATIO,
  LABEL_OVERLAY_BACKGROUND,
  MORE_ISOFORMS_FONT_SCALE,
} from '../../RenderFeatureDataRPC/constants.ts'

import type { ResolvedLabel } from './labelPositioning.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

/**
 * Owns `ctx.font` because the isoform badge draws smaller and italic, and only
 * assigns it when the kind changes: a real canvas re-resolves the face on every
 * assignment. `fontFamily` is an export's, which its overlay boxes are measured
 * in too. Where the context sets runs of text, a name and the badge after it
 * are one line, so a face wider than the one the badge's offset was measured
 * in cannot run the name into it: an SVG `<text>` with the badge in a
 * `<tspan>`.
 */
export function paintLabels(
  ctx: Ctx2D,
  labels: ResolvedLabel[],
  fontSize: number,
  fontFamily = 'sans-serif',
) {
  const badgeFont = `italic ${fontSize * MORE_ISOFORMS_FONT_SCALE}px ${fontFamily}`
  const runs = 'fillTextRuns' in ctx ? ctx : undefined
  let curFont = ''
  const setFont = (font: string) => {
    if (font !== curFont) {
      ctx.font = font
      curFont = font
    }
  }
  for (let i = 0; i < labels.length; i++) {
    const resolved = labels[i]!
    const { label, labelX, labelY } = resolved
    if (resolved.kind === 'more') {
      // An expanded badge reads "show fewer", an instruction to a control no
      // canvas or export carries.
      if (resolved.label.expanded) {
        continue
      }
      setFont(badgeFont)
    } else {
      setFont(`${resolved.fontSize}px ${fontFamily}`)
      if (resolved.label.isOverlay) {
        ctx.fillStyle = LABEL_OVERLAY_BACKGROUND
        ctx.fillRect(
          labelX - 1,
          labelY,
          measureText(label.text, resolved.fontSize, fontFamily) + 2,
          resolved.fontSize + 1,
        )
      }
    }
    // labelY is the label's top, so convert to the baseline fillText wants,
    // off the shared line's size so a smaller badge sits on the name's baseline.
    const lineSize = resolved.kind === 'more' ? fontSize : resolved.fontSize
    const baselineY = Math.round(labelY + lineSize * LABEL_BASELINE_RATIO)
    const badge = labels[i + 1]
    if (
      runs &&
      resolved.kind === 'name' &&
      badge?.kind === 'more' &&
      !badge.label.expanded
    ) {
      runs.fillTextRuns(
        [
          { text: label.text, font: curFont, fillStyle: resolved.color },
          { text: badge.label.text, font: badgeFont, fillStyle: badge.color },
        ],
        labelX,
        baselineY,
      )
      i++
    } else {
      ctx.fillStyle = resolved.color
      ctx.fillText(label.text, labelX, baselineY)
    }
  }
}
