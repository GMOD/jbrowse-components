import {
  insertionBarWidth,
  insertionMarkerDraws,
  textWidthForNumber,
} from '@jbrowse/alignments-core'

import { MIN_CELL_PX } from './shaders/variant.consts.generated.ts'
import { snapVariantCellX } from './snapVariantCellX.ts'

// The widest an insertion marker can ever get: insertionBarWidth caps at the
// count label's box (textWidthForNumber), so the hit-test's search window needs
// no per-region maximum — half of this plus the click tolerance covers every
// marker the insertion mark can draw.
export const MAX_INSERTION_MARKER_WIDTH_PX = textWidthForNumber(99999)

/**
 * The horizontal pixel extent one variant cell actually paints, in the block's
 * screen space. `x1`/`x2` are the cell's reference span already mapped to px
 * (either order — reversed blocks hand them back swapped).
 *
 * A cell is normally its reference span with a MIN_CELL_PX floor, mirroring
 * the shader (`shaders/variant.slang`) and `cellMark`. An insertion is the
 * exception: it consumes no reference, so the insertion mark widens
 * alt-carrying cells to a marker sized by the inserted bp, centered on the
 * locus, wherever `insertionMarkerDraws` says the marker outgrows the span —
 * the mark's own rule, so the drawn glyph, the hover highlight and the click
 * target are the same width. The extent is the union of the cell and the
 * marker.
 *
 * **`insertionsWiden` is `showInsertionGlyphs`, and it has no default.** With
 * it off an insertion is drawn at the floor like a SNP, so a caller defaulting
 * to "yes" would measure a 40px bar over a 2px cell.
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
  if (
    insertionsWiden &&
    cellCanDrawMarker({ spanPx: x2 - x1, insertedBp, pxPerBp, drawnRowHeight })
  ) {
    const markerWidth = insertionBarWidth(insertedBp, pxPerBp, drawnRowHeight)
    const lo = Math.min(left, center - markerWidth / 2)
    const hi = Math.max(left + width, center + markerWidth / 2)
    return { left: lo, width: hi - lo, drawsMarker: true, center }
  }
  return { left, width, drawsMarker: false, center }
}

/**
 * Whether a record's insertion marker draws over `spanPx` of reference: the
 * insertion mark's own gate, which reads no pan phase, so the legend asks the
 * painter's question without a block's offset.
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
    insertionMarkerDraws(
      insertionBarWidth(insertedBp, pxPerBp, drawnRowHeight),
      spanPx,
      MIN_CELL_PX,
    )
  )
}
