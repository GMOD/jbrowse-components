import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'

import { variantCellSpanPx } from './variantCellSpan.ts'

import type { VariantRenderBlock } from './variantRenderingBackendTypes.ts'

/**
 * The two per-feature arrays every pass over records needs: where each record
 * is, and how much sequence it inserts (which is the one thing its reference
 * span cannot express).
 */
export interface FeatureSpanData {
  featurePositions: Uint32Array
  featureInsertedBp: Int32Array
}

/** One record's drawn extent within a block, plus where its center landed. */
export interface FeatureSpan {
  left: number
  width: number
  /** True when the insertion marker is wider than the reference span under it. */
  drawsMarker: boolean
  /** Center of the *reference* span — where a marker is centered. */
  center: number
}

/**
 * Walk every record in one block, handing each its drawn pixel extent.
 *
 * Three passes over this display's payload are "do something per record at its
 * drawn span": the insertion-marker geometry (`markersForBlock`), the variant
 * lane, and — through them — the legend's "does this window draw a marker"
 * question. They must agree to the pixel: a marker sized against a different
 * span than the mark it widens, or a lane mark one pixel off the column beneath
 * it, is not a crash, it is a screenshot that reads as a rendering bug.
 *
 * A callback rather than materialized arrays, because this runs per block per
 * frame: `markersForBlock` wants its results in typed arrays and the lane wants
 * to paint immediately, and forcing the lane through an allocation it does not
 * need would be paying for the sharing. Both get the same numbers either way,
 * which is the whole point.
 *
 * `drawnHeight` is the band the record is drawn in — a genotype row for the
 * cells, the lane's height for the lane — because that is what
 * `insertionBarWidth` sizes a marker against.
 *
 * `pxPerBp` comes back because callers need it for the marker's own geometry
 * (`drawInsertionMarker`, `getInsertionType`), and re-deriving it beside a call
 * to this is how the two would drift.
 */
export function forEachFeatureSpan(
  region: FeatureSpanData,
  block: VariantRenderBlock,
  drawnHeight: number,
  cb: (featureIndex: number, span: FeatureSpan) => void,
) {
  const toX = makeBpMapper(block)
  const pxPerBp =
    (block.screenEndPx - block.screenStartPx) / (block.end - block.start)
  const numFeatures = region.featureInsertedBp.length
  // One object, rewritten per record rather than allocated per record: this is
  // a per-frame loop over thousands of features and the callback never retains
  // it (both callers read the fields immediately). Stated because it is the
  // kind of reuse that is a bug if anyone ever stashes the span.
  const span: FeatureSpan = { left: 0, width: 0, drawsMarker: false, center: 0 }
  for (let f = 0; f < numFeatures; f++) {
    const x1 = toX(region.featurePositions[f * 2]!)
    const x2 = toX(region.featurePositions[f * 2 + 1]!)
    const { left, width, drawsMarker } = variantCellSpanPx({
      x1,
      x2,
      insertedBp: region.featureInsertedBp[f]!,
      pxPerBp,
      drawnRowHeight: drawnHeight,
    })
    span.left = left
    span.width = width
    span.drawsMarker = drawsMarker
    span.center = (x1 + x2) / 2
    cb(f, span)
  }
  return pxPerBp
}
