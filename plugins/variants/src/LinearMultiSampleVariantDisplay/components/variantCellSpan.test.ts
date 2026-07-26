import { insertionBarWidth } from '@jbrowse/alignments-core'

import {
  MAX_INSERTION_MARKER_WIDTH_PX,
  variantCellSpanPx,
} from './variantCellSpan.ts'

// Row tall enough to draw an insertion's count label, which is what earns a
// 'large' insertion the wide box (insertionBarWidth's featureHeight arg).
const TALL_ROW = 10

describe('variantCellSpanPx without an insertion', () => {
  test('a wide reference span is itself', () => {
    expect(
      variantCellSpanPx({
        x1: 100,
        x2: 140,
        insertedBp: 0,
        pxPerBp: 1,
        drawnRowHeight: TALL_ROW,
      }),
    ).toEqual({ left: 100, width: 40, drawsMarker: false })
  })

  test('a sub-pixel span takes the 2px floor the shader and Canvas2D use', () => {
    expect(
      variantCellSpanPx({
        x1: 100,
        x2: 100.2,
        insertedBp: 0,
        pxPerBp: 0.2,
        drawnRowHeight: TALL_ROW,
      }),
    ).toEqual({ left: 100, width: 2, drawsMarker: false })
  })

  test('a reversed block hands x1/x2 back swapped', () => {
    expect(
      variantCellSpanPx({
        x1: 140,
        x2: 100,
        insertedBp: 0,
        pxPerBp: 1,
        drawnRowHeight: TALL_ROW,
      }),
    ).toEqual({ left: 100, width: 40, drawsMarker: false })
  })
})

describe('variantCellSpanPx with an insertion', () => {
  test('a large insertion widens to a marker centered on its locus', () => {
    // 5000 bp inserted at 0.2 px/bp is 'large' (>= 15px of screen), so the
    // marker is the count-label box — far wider than the ~1bp reference span.
    const markerWidth = insertionBarWidth(5000, 0.2, TALL_ROW)
    expect(markerWidth).toBeGreaterThan(2)
    expect(
      variantCellSpanPx({
        x1: 100,
        x2: 100.2,
        insertedBp: 5000,
        pxPerBp: 0.2,
        drawnRowHeight: TALL_ROW,
      }),
    ).toEqual({
      left: 100.1 - markerWidth / 2,
      width: markerWidth,
      drawsMarker: true,
    })
  })

  test('centering survives a reversed block', () => {
    const forward = variantCellSpanPx({
      x1: 100,
      x2: 100.2,
      insertedBp: 5000,
      pxPerBp: 0.2,
      drawnRowHeight: TALL_ROW,
    })
    expect(
      variantCellSpanPx({
        x1: 100.2,
        x2: 100,
        insertedBp: 5000,
        pxPerBp: 0.2,
        drawnRowHeight: TALL_ROW,
      }),
    ).toEqual(forward)
  })

  test('no marker when the reference span is already wider', () => {
    // Zoomed in far enough that the cell out-measures the bar the insertion
    // would draw, so the overlay stays out of the way and the plain span wins.
    expect(
      variantCellSpanPx({
        x1: 100,
        x2: 300,
        insertedBp: 5,
        pxPerBp: 10,
        drawnRowHeight: TALL_ROW,
      }),
    ).toEqual({ left: 100, width: 200, drawsMarker: false })
  })

  test('a short row falls back to the unlabelled bar, not the wide box', () => {
    const { width, drawsMarker } = variantCellSpanPx({
      x1: 100,
      x2: 100.2,
      insertedBp: 5000,
      pxPerBp: 0.2,
      drawnRowHeight: 1,
    })
    expect(drawsMarker).toBe(true)
    expect(width).toBe(insertionBarWidth(5000, 0.2, 1))
    expect(width).toBeLessThan(MAX_INSERTION_MARKER_WIDTH_PX)
  })
})

test('MAX_INSERTION_MARKER_WIDTH_PX really is the cap the hit-test pads by', () => {
  // The flatbush search window is derived from this constant, so a marker wider
  // than it would be drawn but unhoverable (see variantHitTest.HIT_SEARCH_PAD_PX).
  for (const len of [1, 9, 10, 99, 1000, 65481, 1e6, 1e9]) {
    for (const pxPerBp of [0.001, 0.2, 1, 100]) {
      expect(insertionBarWidth(len, pxPerBp, TALL_ROW)).toBeLessThanOrEqual(
        MAX_INSERTION_MARKER_WIDTH_PX,
      )
    }
  }
})
