import {
  LABEL_BASELINE_RATIO,
  LABEL_OVERLAY_BACKGROUND,
  MORE_ISOFORMS_FONT_SCALE,
  renderedTextWidth,
} from '../../RenderFeatureDataRPC/constants.ts'

import type { ResolvedLabel } from './labelPositioning.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

/**
 * Paint the labels `forEachDisplayLabel` resolved, onto a canvas.
 *
 * This display renders its labels as DOM overlays on screen, so its own renderer
 * does not draw them and this is the vector post-pass its SVG export runs after
 * `drawFeatureBlocks` has painted the geometry.
 *
 * It is also how a caller that draws this data on a *canvas* letters it, which
 * the multi-sample variant display's lane does: a band 40px tall has no room for
 * a DOM label layer's worth of chrome, and its marks have to read identically to
 * the same records in a `LinearVariantDisplay` — so it pairs this with the same
 * `forEachDisplayLabel` walk the export uses rather than lettering them itself.
 *
 * Owns `ctx.font` rather than taking it set: the isoform badge draws smaller and
 * italic (floatingLabelMore is the DOM half of the same choice), so the pass has
 * two fonts in it and neither caller nor callee can hold just one. Free to
 * reassign per label here — the export's ctx is an SvgCanvas, which stores the
 * shorthand and parses it at serialize time.
 */
export function paintLabels(
  ctx: Ctx2D,
  labels: ResolvedLabel[],
  fontSize: number,
) {
  for (const resolved of labels) {
    const { label, labelX, labelY } = resolved
    if (resolved.kind === 'more') {
      // "+20 more" is a fact about the picture and belongs in it. Its expanded
      // form reads "show fewer", an instruction to a control the export does not
      // carry, over a gene the export has already drawn in full.
      if (resolved.label.expanded) {
        continue
      }
      ctx.font = `italic ${fontSize * MORE_ISOFORMS_FONT_SCALE}px sans-serif`
    } else {
      ctx.font = `${fontSize}px sans-serif`
      if (resolved.label.isOverlay) {
        ctx.fillStyle = LABEL_OVERLAY_BACKGROUND
        // The baked textWidth is measured at the base font size; scale it to
        // what this mode draws so the backing rect hugs the text like the
        // on-screen DOM version (a CSS background on the label div) does.
        ctx.fillRect(
          labelX - 1,
          labelY,
          renderedTextWidth(label.textWidth, fontSize) + 2,
          fontSize + 1,
        )
      }
    }
    ctx.fillStyle = label.color
    // labelY is the label's TOP (the DOM overlay positions the div by it), so
    // convert to the baseline fillText wants. Alphabetic baseline rather than
    // ctx.textBaseline = 'top': SvgCanvas maps that to dominant-baseline
    // "hanging", which downstream SVG consumers (Inkscape, librsvg) place
    // inconsistently, while an explicit y is portable everywhere. Rounded
    // because SvgCanvas interpolates coordinates raw — the unrounded product
    // serializes as y="21.240000000000002" for no visible gain.
    //
    // Off the shared line's size rather than each label's own, so the smaller
    // badge sits on the name's baseline instead of a lower one of its own.
    ctx.fillText(
      label.text,
      labelX,
      Math.round(labelY + fontSize * LABEL_BASELINE_RATIO),
    )
  }
}
