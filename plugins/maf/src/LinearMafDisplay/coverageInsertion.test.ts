import { emptyMafCoverage } from './components/coverageTestFixture.ts'
import { coverageInsertionAt } from './coverageInsertion.ts'

import type { MafCoverageRegion } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'

function cov(overrides: Partial<MafCoverageRegion>): MafCoverageRegion {
  // depths for genomic 100..104
  return {
    ...emptyMafCoverage(100),
    coverageDepths: new Float32Array([5, 5, 5, 5, 5]),
    insertionPositions: new Uint32Array([102]),
    insertionLengths: new Uint32Array([3]),
    ...overrides,
  }
}

test('hits an insertion at its boundary', () => {
  expect(coverageInsertionAt(cov({}), 102, 1)).toMatchObject({
    position: 102,
    count: 1,
    minLen: 3,
    maxLen: 3,
    interbaseDepth: 5,
  })
})

test('misses a position with no insertion', () => {
  expect(coverageInsertionAt(cov({}), 104, 1)).toBeUndefined()
})

test('pixel gate: misses when the cursor is past the bar at high zoom', () => {
  // bpPerPx 0.1, small insertion → bar half-width ~0.25bp around the boundary
  expect(coverageInsertionAt(cov({}), 102.4, 0.1)).toBeUndefined()
  expect(coverageInsertionAt(cov({}), 102.1, 0.1)).toMatchObject({ count: 1 })
})

test('zoomed out: snaps to the nearest insertion within the pixel target', () => {
  // bpPerPx 10 → one pixel spans 10bp, so round(gposFrac) rarely equals the
  // exact insertion coord (102). Cursor at 100.5 is within ~2.5px of the bar.
  expect(coverageInsertionAt(cov({}), 100.5, 10)).toMatchObject({
    position: 102,
    count: 1,
  })
})

test('zoomed out: misses when the cursor is past the bar pixel target', () => {
  // bpPerPx 10, small insertion → ~2.5px half-width = 25bp; 90 is 12bp away.
  expect(coverageInsertionAt(cov({}), 130, 10)).toBeUndefined()
})

test('aggregates multiple insertions at the same boundary', () => {
  const coverage = cov({
    insertionPositions: new Uint32Array([102, 102]),
    insertionLengths: new Uint32Array([2, 6]),
  })
  expect(coverageInsertionAt(coverage, 102, 1)).toMatchObject({
    count: 2,
    minLen: 2,
    maxLen: 6,
  })
})
