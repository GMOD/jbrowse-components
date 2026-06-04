import { calculateModificationCounts } from './calculateModificationCounts.ts'

import type { StrandBaseCounts } from './calculateModificationCounts.ts'

// A CpG covered by 10 reads: 5 forward showing the reference C, 5 reverse
// showing the reference C as well (reads carry the reference base regardless of
// orientation). The mod sits on C; its complement G has no reads here.
const cpg: StrandBaseCounts = {
  C: { fwd: 5, rev: 5 },
}

test('duplex: detectable equals modifiable (both strands basecalled)', () => {
  const { modifiable, detectable } = calculateModificationCounts({
    base: 'C',
    isSimplex: false,
    strandBaseCounts: cpg,
  })
  expect(modifiable).toBe(10)
  expect(detectable).toBe(10)
})

test('simplex C+m: only forward C + reverse complement counts as detectable', () => {
  const { modifiable, detectable } = calculateModificationCounts({
    base: 'C',
    isSimplex: true,
    strandBaseCounts: cpg,
  })
  // all 10 reads have a C/G here, but only the 5 forward reads were examined
  expect(modifiable).toBe(10)
  expect(detectable).toBe(5)
})

test('simplex at a reference-G position: reverse reads are detectable', () => {
  // reverse-aligned C+m calls map onto reference G positions
  const refG: StrandBaseCounts = { G: { fwd: 4, rev: 6 } }
  const { modifiable, detectable } = calculateModificationCounts({
    base: 'C',
    isSimplex: true,
    strandBaseCounts: refG,
  })
  // base C absent, complement G present; detectable = baseFwd(C)=0 + complRev(G)=6
  expect(modifiable).toBe(10)
  expect(detectable).toBe(6)
})

test('modifiable sums the base and its complement', () => {
  const withSnp: StrandBaseCounts = {
    C: { fwd: 5, rev: 3 },
    G: { fwd: 1, rev: 1 },
    A: { fwd: 2, rev: 0 },
  }
  const { modifiable, detectable } = calculateModificationCounts({
    base: 'C',
    isSimplex: false,
    strandBaseCounts: withSnp,
  })
  // C (5+3) + G (1+1) = 10, ignoring the unrelated A reads
  expect(modifiable).toBe(10)
  expect(detectable).toBe(10)
})

test('N base: both counts are total depth across all bases', () => {
  const counts: StrandBaseCounts = {
    A: { fwd: 3, rev: 2 },
    C: { fwd: 1, rev: 4 },
  }
  const { modifiable, detectable } = calculateModificationCounts({
    base: 'N',
    isSimplex: true,
    strandBaseCounts: counts,
  })
  expect(modifiable).toBe(10)
  expect(detectable).toBe(10)
})

test('detectable never exceeds modifiable', () => {
  const counts: StrandBaseCounts = {
    C: { fwd: 7, rev: 2 },
    G: { fwd: 3, rev: 8 },
  }
  for (const isSimplex of [true, false]) {
    const { modifiable, detectable } = calculateModificationCounts({
      base: 'C',
      isSimplex,
      strandBaseCounts: counts,
    })
    expect(detectable).toBeLessThanOrEqual(modifiable)
  }
})
