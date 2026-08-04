import { insertionBarWidth, textWidthForNumber } from '@jbrowse/alignments-core'

import { snappedCellWidthPx } from './shaders/variant.js.generated.ts'

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
 * `insertedBp` of 0 (every SNP and deletion) short-circuits to the plain span.
 */
export function variantCellSpanPx({
  x1,
  x2,
  insertedBp,
  pxPerBp,
  drawnRowHeight,
}: {
  x1: number
  x2: number
  insertedBp: number
  pxPerBp: number
  drawnRowHeight: number
}) {
  const left = Math.min(x1, x2)
  // The shader's own 2px floor, generated into TS (adr-051), rather than a
  // fourth hand-written copy of it.
  const width = snappedCellWidthPx(left, Math.max(x1, x2))
  const markerWidth =
    insertedBp > 0 ? insertionBarWidth(insertedBp, pxPerBp, drawnRowHeight) : 0
  if (markerWidth > width) {
    const center = (x1 + x2) / 2
    return {
      left: center - markerWidth / 2,
      width: markerWidth,
      drawsMarker: true,
    }
  }
  return { left, width, drawsMarker: false }
}
