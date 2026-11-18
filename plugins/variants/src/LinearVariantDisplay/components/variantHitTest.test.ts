import { MIN_CELL_PX } from './shaders/variant.consts.generated.ts'
import { HIT_TOLERANCE_PX, computeVariantHitQuery } from './variantHitTest.ts'

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
    expect(computeVariantHitQuery(fwd, 0, 0, 0, 10, 1).genomicPos).toBe(1000)
    expect(computeVariantHitQuery(fwd, 50, 0, 0, 10, 1).genomicPos).toBe(1500)
    expect(computeVariantHitQuery(fwd, 100, 0, 0, 10, 1).genomicPos).toBe(2000)
  })

  test('reversed region flips the mapping', () => {
    const rev = { ...fwd, reversed: true }
    expect(computeVariantHitQuery(rev, 0, 0, 0, 10, 1).genomicPos).toBe(2000)
    expect(computeVariantHitQuery(rev, 50, 0, 0, 10, 1).genomicPos).toBe(1500)
    expect(computeVariantHitQuery(rev, 100, 0, 0, 10, 1).genomicPos).toBe(1000)
  })

  test('honors a non-zero screenStartPx offset', () => {
    const shifted = { ...fwd, screenStartPx: 20, screenEndPx: 120 }
    expect(computeVariantHitQuery(shifted, 20, 0, 0, 10, 1).genomicPos).toBe(
      1000,
    )
    expect(computeVariantHitQuery(shifted, 120, 0, 0, 10, 1).genomicPos).toBe(
      2000,
    )
  })

  test('bpPadding reaches a click tolerance past the widest a cell draws', () => {
    expect(computeVariantHitQuery(fwd, 0, 0, 0, 10, 1).bpPadding).toBe(
      (HIT_TOLERANCE_PX + MIN_CELL_PX + 1) * 10,
    )
  })
})

describe('computeVariantHitQuery row band clamps at the top', () => {
  test('a cursor in the first sub-pixel rows never asks for a negative row', () => {
    const { rowNearest, rowLowest } = computeVariantHitQuery(
      fwd,
      0,
      1,
      0,
      0.5,
      1,
    )
    expect(rowNearest).toBe(2)
    expect(rowLowest).toBe(0)
  })
})

describe('computeVariantHitQuery row band', () => {
  test('normal rows: band collapses to the single row under the cursor', () => {
    // cursor at content-Y 25, rowHeight 10 → row 2, and only row 2 (row 1 ends
    // at Y 20, row 3 starts at Y 30).
    const { rowNearest, rowLowest } = computeVariantHitQuery(
      fwd,
      0,
      25,
      0,
      10,
      1,
    )
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
      1,
    )
    expect(rowNearest).toBe(12)
    expect(rowLowest).toBe(12)
  })

  test.each([1, 1.5])(
    '%spx rows: every cursor pixel is under its own row alone',
    rowHeight => {
      for (let mouseY = 0; mouseY < 30; mouseY++) {
        const { rowNearest, rowLowest } = computeVariantHitQuery(
          fwd,
          0,
          mouseY,
          0,
          rowHeight,
          1,
        )
        expect(rowLowest).toBe(rowNearest)
      }
    },
  )

  test('sub-pixel rows: one cursor pixel spans a band of many rows', () => {
    // rowHeight 0.5 draws 1.5px, on whole pixels. Row 48 spans 24..25.5,
    // snapped to 24..26; rows 49 and 50 start on pixel 25 and row 51 on 26, so
    // rows 48..50 are the drawn cells covering pixel 25, and row 50 is the row
    // the cursor is in.
    const { rowNearest, rowLowest } = computeVariantHitQuery(
      fwd,
      0,
      25,
      0,
      0.5,
      1,
    )
    expect(rowNearest).toBe(50)
    expect(rowLowest).toBe(48)
  })
})
