import { insertionBarWidth, textWidthForNumber } from '@jbrowse/alignments-core'

import { snapVariantCellX } from './snapVariantCellX.ts'

// The widest an insertion marker can ever get: insertionBarWidth caps at the
// count label's box (textWidthForNumber), so the hit-test's search window needs
// no per-region maximum — half of this plus the click tolerance covers every
// marker the overlay can draw.
export const MAX_INSERTION_MARKER_WIDTH_PX = textWidthForNumber(99999)

/**
 * The horizontal pixel extent one variant cell actually paints, in the block's
 * screen space. `x1`/`x2` are the cell's reference span already mapped to px
 * (either order — reversed blocks hand them back swapped).
 *
 * A cell is normally its reference span with a 2px floor, mirroring the shader
 * (`shaders/variant.slang`) and `cellMark`. An insertion is the
 * exception: it consumes no reference, so `VariantInsertionGlyphOverlay` widens
 * alt-carrying cells to a marker sized by the inserted bp, centered on the
 * locus. Returning the union here keeps the drawn glyph, the hover highlight
 * and the click target the same width, so a 40px insertion marker responds
 * across its whole 40px.
 *
 * **`insertionsWiden` is `showInsertionGlyphs`, and it has no default.** The
 * display setting decides whether an insertion is a marker at all or is drawn
 * at the 2px floor like a SNP, so every caller states it. With a default of
 * "yes", a caller other than the marker painter would disagree with the
 * painter whenever glyphs are switched off: the cells and the GPU pass draw a
 * 2px SNP while that caller measures a 40px bar, the hover box covers 40px of
 * nothing, and a click 20px clear of the cell still selects it.
 * `markersForBlock` always passes `true`, because a marker is the widening.
 *
 * `insertedBp` of 0 (every SNP and deletion) short-circuits to the plain span.
 */
export function variantCellSpanPx({
  x1,
  x2,
  insertedBp,
  insertionsWiden,
  pxPerBp,
  drawnRowHeight,
}: {
  x1: number
  x2: number
  insertedBp: number
  insertionsWiden: boolean
  pxPerBp: number
  drawnRowHeight: number
}) {
  const { x: left, width } = snapVariantCellX(x1, x2)
  const center = (x1 + x2) / 2
  const markerWidth =
    insertionsWiden && insertedBp > 0
      ? insertionBarWidth(insertedBp, pxPerBp, drawnRowHeight)
      : 0
  if (markerWidth > width) {
    return {
      left: center - markerWidth / 2,
      width: markerWidth,
      drawsMarker: true,
      center,
    }
  }
  return { left, width, drawsMarker: false, center }
}

/**
 * Whether a record's insertion marker outgrows its cell at ANY sub-pixel pan
 * position, rather than at the one on screen now.
 *
 * `snappedCellWidthPx` floors both edges, so a cell of a given reference span
 * measures `floor(spanPx)` or one more depending on where the grid lands, while
 * the marker width has no phase term at all. Comparing against the narrowest
 * the cell can be is therefore the union over every pan position — which is
 * what the legend wants and the painter does not: a swatch that does not come
 * and go with a half-pixel drag, and that a single-frame export resolves
 * without waiting for anything to settle.
 *
 * `spanPx` is a difference of mapped edges, so it carries no `offsetPx` term.
 * That is the whole reason this can be asked without a block's phase.
 */
export function cellCanDrawMarker({
  spanPx,
  insertedBp,
  pxPerBp,
  drawnRowHeight,
}: {
  spanPx: number
  insertedBp: number
  pxPerBp: number
  drawnRowHeight: number
}) {
  return (
    insertedBp > 0 &&
    insertionBarWidth(insertedBp, pxPerBp, drawnRowHeight) >
      Math.max(2, Math.floor(Math.abs(spanPx)))
  )
}
