import { MAX_INSERTION_MARKER_WIDTH_PX } from './variantCellSpan.ts'
import {
  HIT_SEARCH_PAD_PX,
  HIT_TOLERANCE_PX,
  computeVariantHitQuery,
} from './variantHitTest.ts'

import type { HitRegion } from './variantHitTest.ts'

// start=1000..end=2000 laid out across screen px 0..100 → 10 bp/px.
const fwd: HitRegion = {
  start: 1000,
  end: 2000,
  reversed: false,
  screenStartPx: 0,
  screenEndPx: 100,
}

describe('computeVariantHitQuery genomicPos', () => {
  test('forward region maps cursor px to genomic bp', () => {
    expect(computeVariantHitQuery(fwd, 0, 0, 0, 10).genomicPos).toBe(1000)
    expect(computeVariantHitQuery(fwd, 50, 0, 0, 10).genomicPos).toBe(1500)
    expect(computeVariantHitQuery(fwd, 100, 0, 0, 10).genomicPos).toBe(2000)
  })

  test('reversed region flips the mapping', () => {
    const rev = { ...fwd, reversed: true }
    expect(computeVariantHitQuery(rev, 0, 0, 0, 10).genomicPos).toBe(2000)
    expect(computeVariantHitQuery(rev, 50, 0, 0, 10).genomicPos).toBe(1500)
    expect(computeVariantHitQuery(rev, 100, 0, 0, 10).genomicPos).toBe(1000)
  })

  test('honors a non-zero screenStartPx offset', () => {
    const shifted = { ...fwd, screenStartPx: 20, screenEndPx: 120 }
    expect(computeVariantHitQuery(shifted, 20, 0, 0, 10).genomicPos).toBe(1000)
    expect(computeVariantHitQuery(shifted, 120, 0, 0, 10).genomicPos).toBe(2000)
  })

  test('bpPadding reaches the far edge of the widest insertion marker', () => {
    // The flatbush boxes are reference spans, but an insertion paints a marker
    // centered on that span, so a cursor on the marker's edge sits
    // MAX_INSERTION_MARKER_WIDTH_PX/2 away from the box it must find.
    expect(HIT_SEARCH_PAD_PX).toBe(
      MAX_INSERTION_MARKER_WIDTH_PX / 2 + HIT_TOLERANCE_PX,
    )
    expect(computeVariantHitQuery(fwd, 0, 0, 0, 10).bpPadding).toBe(
      HIT_SEARCH_PAD_PX * 10,
    )
  })
})

describe('computeVariantHitQuery row band clamps at the top', () => {
  test('a cursor in the first sub-pixel rows never asks for a negative row', () => {
    const { rowNearest, rowLowest } = computeVariantHitQuery(fwd, 0, 1, 0, 0.5)
    expect(rowNearest).toBe(3)
    expect(rowLowest).toBe(0)
  })
})

describe('computeVariantHitQuery row band', () => {
  test('normal rows: band collapses to the single row under the cursor', () => {
    // cursor at content-Y 25, rowHeight 10 → row 2, and only row 2 (row 1 ends
    // at Y 20, row 3 starts at Y 30).
    const { rowNearest, rowLowest } = computeVariantHitQuery(fwd, 0, 25, 0, 10)
    expect(rowNearest).toBe(2)
    expect(rowLowest).toBe(2)
  })

  test('scrollTop shifts the band down into the scrolled content', () => {
    const { rowNearest, rowLowest } = computeVariantHitQuery(
      fwd,
      0,
      25,
      100,
      10,
    )
    expect(rowNearest).toBe(12)
    expect(rowLowest).toBe(12)
  })

  test('sub-pixel rows: one cursor pixel spans a band of many rows', () => {
    // rowHeight 0.5 draws at the 2px minimum, and pixel 25 was filled from its
    // centre — 25.5 — so the drawn cells for rows 48..51 are the ones covering
    // it. Row 51 is the last painted there, so it is tried first.
    const { rowNearest, rowLowest } = computeVariantHitQuery(fwd, 0, 25, 0, 0.5)
    expect(rowNearest).toBe(51)
    expect(rowLowest).toBe(48)
  })
})
