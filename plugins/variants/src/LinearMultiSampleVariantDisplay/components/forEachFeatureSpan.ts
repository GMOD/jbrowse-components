import { makeBpMapper, pxPerBpOf } from '@jbrowse/render-core/canvas2dUtils'

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
  /**
   * Center of the *reference* span, where a marker is centered. Taken from
   * `variantCellSpanPx`, which centers the marker's `left` on it.
   */
  center: number
}

/**
 * Walk every record in one block, handing each its drawn pixel extent.
 *
 * The drawn extent and the marker geometry sized against it must agree to the
 * pixel: a marker sized against a different span than the cell it widens is not
 * a crash, it is a screenshot that reads as a rendering bug. So the span comes
 * from `variantCellSpanPx` here, once.
 *
 * A callback rather than materialized arrays, because this runs per block per
 * frame and `markersForBlock` wants its results in typed arrays.
 *
 * `drawnHeight` is the band the record is drawn in, because that is what
 * `insertionBarWidth` sizes a marker against.
 *
 * `insertionsWiden` is the display's `showInsertionGlyphs`, passed rather than
 * assumed: see `variantCellSpanPx`. `markersForBlock` passes `true` because a
 * marker *is* the widening, and its two callers are already gated on the
 * setting.
 *
 * `pxPerBp` comes back because callers need it for the marker's own geometry
 * (`drawInsertionMarker`, `getInsertionType`), and re-deriving it beside a call
 * to this is how the two would drift.
 */
export function forEachFeatureSpan(
  region: FeatureSpanData,
  block: VariantRenderBlock,
  {
    drawnHeight,
    insertionsWiden,
  }: { drawnHeight: number; insertionsWiden: boolean },
  cb: (featureIndex: number, span: FeatureSpan) => void,
) {
  const toX = makeBpMapper(block)
  const pxPerBp = pxPerBpOf(block)
  const numFeatures = region.featureInsertedBp.length
  // One object, rewritten per record rather than allocated per record: this is
  // a per-frame loop over thousands of features and the callback never retains
  // it. Stated because it is the kind of reuse that is a bug if anyone ever
  // stashes the span.
  const span: FeatureSpan = { left: 0, width: 0, drawsMarker: false, center: 0 }
  for (let f = 0; f < numFeatures; f++) {
    const x1 = toX(region.featurePositions[f * 2]!)
    const x2 = toX(region.featurePositions[f * 2 + 1]!)
    const { left, width, drawsMarker, center } = variantCellSpanPx({
      x1,
      x2,
      insertedBp: region.featureInsertedBp[f]!,
      insertionsWiden,
      pxPerBp,
      drawnRowHeight: drawnHeight,
    })
    span.left = left
    span.width = width
    span.drawsMarker = drawsMarker
    span.center = center
    cb(f, span)
  }
  return pxPerBp
}
