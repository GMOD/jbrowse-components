import { computeVariantHitQuery } from './variantHitTest.ts'

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

  test('bpPadding is 5px worth of bp', () => {
    expect(computeVariantHitQuery(fwd, 0, 0, 0, 10).bpPadding).toBe(50)
  })
})

describe('computeVariantHitQuery row band', () => {
  test('normal rows: band collapses to the single row under the cursor', () => {
    // cursor at content-Y 25, rowHeight 10 → row 2.5. The flatbush box for row 2
    // is [2,3], so a point query at 2.5 selects only row 2 (not row 1 above it).
    const { rowLo, rowHi } = computeVariantHitQuery(fwd, 0, 25, 0, 10)
    expect(rowLo).toBe(2.5)
    expect(rowHi).toBe(2.5)
  })

  test('scrollTop shifts the band down into the scrolled content', () => {
    const { rowLo, rowHi } = computeVariantHitQuery(fwd, 0, 25, 100, 10)
    expect(rowLo).toBe(12.5)
    expect(rowHi).toBe(12.5)
  })

  test('sub-pixel rows: one cursor pixel spans a band of many rows', () => {
    // rowHeight 0.5 draws at the 2px minimum, so the drawn cells for rows
    // 46..50 all contain content-Y 25. The query [47,50] overlaps the flatbush
    // boxes down to [46,47] — a single Y-point query would miss most.
    const { rowLo, rowHi } = computeVariantHitQuery(fwd, 0, 25, 0, 0.5)
    expect(rowLo).toBe(47)
    expect(rowHi).toBe(50)
  })
})
