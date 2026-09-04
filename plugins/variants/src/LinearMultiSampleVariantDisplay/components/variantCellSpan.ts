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
 * (`shaders/variant.slang`) and `Canvas2DVariantRenderer`. An insertion is the
 * exception: it consumes no reference, so `VariantInsertionGlyphOverlay` widens
 * alt-carrying cells to a marker sized by the inserted bp, centered on the
 * locus. Returning the union here is what keeps the drawn glyph, the hover
 * highlight, and the click target from disagreeing — a 40px insertion marker
 * used to respond only within 5px of its locus.
 *
 * **`insertionsWiden` is `showInsertionGlyphs`, and it has no default on
 * purpose.** That setting is what decides whether an insertion is a marker at
 * all or is drawn at the 2px floor like a SNP, and it is the display's answer,
 * not this function's — so every caller states it. It had a default of "yes"
 * implicitly, by nobody asking, and every caller that is not the marker painter
 * inherited it: with glyphs switched off the cells and the GPU pass drew a 2px
 * SNP while the callers here drew a 40px bar, the hover box covered 40px of
 * nothing, and a click 20px clear of the cell still selected it.
 * The one place `false` is a tautology rather than a setting is
 * `markersForBlock`, because a marker is the widening.
 *
 * `insertedBp` of 0 (every SNP and deletion) short-circuits to the plain span.
 */
export function variantCellSpanPx({
  x1,
  x2,
  canvasWidth,
  insertedBp,
  insertionsWiden,
  pxPerBp,
  drawnRowHeight,
}: {
  x1: number
  x2: number
  canvasWidth: number
  insertedBp: number
  insertionsWiden: boolean
  pxPerBp: number
  drawnRowHeight: number
}) {
  // Through `snapVariantCellX`, which is what the cell painter itself draws
  // with — not a second spelling of the span that shares only its 2px floor.
  // This used to take `min`/`max` raw and apply `snappedCellWidthPx` alone, so
  // every consumer here sat up to half a pixel off the cell it was describing:
  // measured at 0.48px on a genome-wide window, where the snap fires on every
  // record and every mark is at the 2px floor — a quarter of the mark's width.
  const { x: left, width } = snapVariantCellX(x1, x2, canvasWidth)
  // The *reference* span's centre, unsnapped, and returned either way — see the
  // note above on why a marker is not snapped, and `FeatureSpan.center` for why
  // it is the caller's business. It has to come out of here rather than be
  // re-derived beside a call: `markersForBlock` centres the drawn marker on it
  // while the hover box and the click target take their `left` from the branch
  // below, so two spellings of `(x1 + x2) / 2` are two chances for the glyph and
  // its hit target to be centred on different points.
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
