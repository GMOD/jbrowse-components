import { emptyMafCoverage } from './components/coverageTestFixture.ts'
import { coverageSnpSnap } from './coverageInsertion.ts'

// depth 20 over genomic 1000..1099, one SNP at 1003 (5 of 20 reads → 25%, over
// the shared 5% snap floor).
function cov(mismatchPositions: number[]) {
  return {
    ...emptyMafCoverage(1000),
    coverageDepths: new Float32Array(100).fill(20),
    mismatchPositions: Uint32Array.from(mismatchPositions),
    mismatchBases: Uint8Array.from(mismatchPositions.map(() => 65)),
  }
}

const snp = cov([1003, 1003, 1003, 1003, 1003])

test('base-level zoom does not snap at all', () => {
  expect(coverageSnpSnap(snp, 1000, 1)).toBeUndefined()
})

test('a forward region widens rightward from the base under the cursor', () => {
  expect(coverageSnpSnap(snp, 1000, 10)).toBe(1003)
})

// On a reversed region bp run LEFTWARD, so the pixel holding base 1010 covers
// (1000, 1010] — the SNP at 1003 is in it and one at 1013 is not. Widening
// rightward regardless searched the neighbouring pixel's bp and named a SNP the
// cursor was not over, which is the bug alignments' `hitTestCoverage` fixed.
test('a reversed region widens leftward', () => {
  expect(coverageSnpSnap(snp, 1010, 10, true)).toBe(1003)
})

test('and stops reporting the pixel to its right', () => {
  const rightward = cov([1013, 1013, 1013, 1013, 1013])
  expect(coverageSnpSnap(rightward, 1010, 10, true)).toBeUndefined()
  expect(coverageSnpSnap(rightward, 1010, 10)).toBe(1013)
})
