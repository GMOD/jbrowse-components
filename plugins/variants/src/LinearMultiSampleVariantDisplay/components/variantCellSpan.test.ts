import { insertionBarWidth } from '@jbrowse/alignments-core'
import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'

import { cellMark } from './cellMark.ts'
import {
  MAX_INSERTION_MARKER_WIDTH_PX,
  variantCellSpanPx,
} from './variantCellSpan.ts'

// Row tall enough to draw an insertion's count label, which is what earns a
// 'large' insertion the wide box (insertionBarWidth's featureHeight arg).
const TALL_ROW = 10

// The snap grid is centred on the canvas, so an EVEN width snaps whole pixels to
// themselves — which keeps every expectation below about the span rather than
// about the grid. The grid itself is `snapVariantCellX.test.ts`'s subject; what
// the block at the bottom of this file pins is that this function is reading it.
const CANVAS = 800

describe('variantCellSpanPx without an insertion', () => {
  test('a wide reference span is itself', () => {
    expect(
      variantCellSpanPx({
        x1: 100,
        x2: 140,
        insertedBp: 0,
        insertionsWiden: true,
        pxPerBp: 1,
        drawnRowHeight: TALL_ROW,
      }),
    ).toEqual({ left: 100, width: 40, drawsMarker: false, center: 120 })
  })

  test('a sub-pixel span takes the 2px floor the shader and Canvas2D use', () => {
    expect(
      variantCellSpanPx({
        x1: 100,
        x2: 100.2,
        insertedBp: 0,
        insertionsWiden: true,
        pxPerBp: 0.2,
        drawnRowHeight: TALL_ROW,
      }),
    ).toEqual({ left: 100, width: 2, drawsMarker: false, center: 100.1 })
  })

  // The 2px floor grows away from the record's START, which on a reversed block
  // is its right edge — `spanLeft`'s pivot, carried here from the cell painter.
  // Every record is sub-pixel at genome-wide zoom, so on a flipped region this
  // is the difference between the lane mark, the hover box and the click target
  // sitting on the record and sitting a full mark-width past it.
  test('a sub-pixel span on a reversed block hangs off its start edge', () => {
    const args = {
      insertedBp: 0,
      insertionsWiden: false,
      pxPerBp: 1,
      drawnRowHeight: TALL_ROW,
    }
    expect(variantCellSpanPx({ ...args, x1: 100.2, x2: 100.3 })).toMatchObject({
      left: 100,
      width: 2,
    })
    expect(variantCellSpanPx({ ...args, x1: 100.3, x2: 100.2 })).toMatchObject({
      left: 98,
      width: 2,
    })
  })

  test('a reversed block hands x1/x2 back swapped', () => {
    expect(
      variantCellSpanPx({
        x1: 140,
        x2: 100,
        insertedBp: 0,
        insertionsWiden: true,
        pxPerBp: 1,
        drawnRowHeight: TALL_ROW,
      }),
    ).toEqual({ left: 100, width: 40, drawsMarker: false, center: 120 })
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
        insertionsWiden: true,
        pxPerBp: 0.2,
        drawnRowHeight: TALL_ROW,
      }),
    ).toEqual({
      left: 100.1 - markerWidth / 2,
      width: markerWidth,
      drawsMarker: true,
      center: 100.1,
    })
  })

  test('centering survives a reversed block', () => {
    const forward = variantCellSpanPx({
      x1: 100,
      x2: 100.2,
      insertedBp: 5000,
      insertionsWiden: true,
      pxPerBp: 0.2,
      drawnRowHeight: TALL_ROW,
    })
    expect(
      variantCellSpanPx({
        x1: 100.2,
        x2: 100,
        insertedBp: 5000,
        insertionsWiden: true,
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
        insertionsWiden: true,
        pxPerBp: 10,
        drawnRowHeight: TALL_ROW,
      }),
    ).toEqual({ left: 100, width: 200, drawsMarker: false, center: 200 })
  })

  // `markersForBlock` hands `center` to `drawInsertionMarker`, which centers the
  // bar on it, while the hover box and the click target take `left`/`width`. The
  // two numbers therefore have to describe one rect — which they do by
  // construction only because both now come out of this function.
  test('the marker the overlay draws is the rect the hit test uses', () => {
    // 50bp is the narrow bar form, the rest the count-label box — both are
    // centered marks, and the box is the one wide enough for a mis-centred hit
    // target to be clickable off the glyph.
    for (const insertedBp of [50, 100, 500, 5000, 65481]) {
      const { left, width, drawsMarker, center } = variantCellSpanPx({
        x1: 100,
        x2: 100.2,
        insertedBp,
        insertionsWiden: true,
        pxPerBp: 0.2,
        drawnRowHeight: TALL_ROW,
      })
      expect(drawsMarker).toBe(true)
      expect(left + width / 2).toBeCloseTo(center, 10)
    }
  })

  test('a short row falls back to the unlabelled bar, not the wide box', () => {
    const { width, drawsMarker } = variantCellSpanPx({
      x1: 100,
      x2: 100.2,
      insertedBp: 5000,
      insertionsWiden: true,
      pxPerBp: 0.2,
      drawnRowHeight: 1,
    })
    expect(drawsMarker).toBe(true)
    expect(width).toBe(insertionBarWidth(5000, 0.2, 1))
    expect(width).toBeLessThan(MAX_INSERTION_MARKER_WIDTH_PX)
  })
})

// `showInsertionGlyphs: false` means an insertion is drawn at the 2px floor
// like a SNP — in the GPU cells, and so in every geometry derived from them.
// The lane, the hover box and the click target all read this function, so the
// gate lives here rather than three times over: with it off they went on
// widening while the cells did not, and a 40px mark sat over a 2px column.
describe('variantCellSpanPx with insertion widening switched off', () => {
  test('the largest insertion is its plain reference span', () => {
    expect(
      variantCellSpanPx({
        x1: 100,
        x2: 100.2,
        insertedBp: 5000,
        insertionsWiden: false,
        pxPerBp: 0.2,
        drawnRowHeight: TALL_ROW,
      }),
    ).toEqual({ left: 100, width: 2, drawsMarker: false, center: 100.1 })
  })

  test('a record that inserts nothing is unaffected either way', () => {
    const args = {
      x1: 100,
      x2: 140,
      insertedBp: 0,
      pxPerBp: 1,
      drawnRowHeight: TALL_ROW,
    }
    expect(variantCellSpanPx({ ...args, insertionsWiden: false })).toEqual(
      variantCellSpanPx({ ...args, insertionsWiden: true }),
    )
  })
})

describe('the span is the one the cell painter drew', () => {
  function spanAndInk(
    startBp: number,
    endBp: number,
    canvasWidth: number,
    reversed: boolean,
  ) {
    const block = {
      displayedRegionIndex: 0,
      start: 0,
      end: canvasWidth * 100,
      screenStartPx: 0,
      screenEndPx: canvasWidth,
      reversed,
    }
    const toX = makeBpMapper(block)
    const ink = cellMark.ink!(
      {
        startEnd: Uint32Array.of(startBp, endBp),
        row: Uint32Array.of(0),
        shapeType: Uint8Array.of(0),
        color: Uint32Array.of(0),
        count: 1,
      },
      block,
      { canvasWidth, canvasHeight: TALL_ROW },
      { rowHeight: TALL_ROW, scrollTop: 0 },
      0,
    )!
    const span = variantCellSpanPx({
      x1: toX(startBp),
      x2: toX(endBp),
      insertedBp: 0,
      insertionsWiden: false,
      pxPerBp: 0.01,
      drawnRowHeight: TALL_ROW,
    })
    return { span: [span.left, span.width], ink: [ink.left, ink.width] }
  }

  test.each([0, 20, 37, 50, 74, 90])(
    'agrees for a sub-pixel record at +%i/100 px',
    frac => {
      const { span, ink } = spanAndInk(
        10_000 + frac,
        10_040 + frac,
        CANVAS,
        false,
      )
      expect(span).toEqual(ink)
    },
  )

  test.each([false, true])(
    'agrees on an odd canvas, whose grid sits on half-pixels, reversed %s',
    reversed => {
      const { span, ink } = spanAndInk(10_030, 10_070, 801, reversed)
      expect(span).toEqual(ink)
    },
  )
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
