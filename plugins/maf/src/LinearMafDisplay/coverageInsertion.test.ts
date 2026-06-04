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
