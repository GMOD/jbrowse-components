import { computeReadBaseCounts } from './readBaseCounts.ts'

import type { Feature } from '@jbrowse/core/util'

// Minimal Feature stub: only the fields computeReadBaseCounts reads.
function read(over: {
  start: number
  seq: string
  CIGAR: string
  flags?: number
}): Feature {
  const fields: Record<string, unknown> = { flags: 0, ...over }
  return { get: (k: string) => fields[k] } as unknown as Feature
}

test('tallies forward-frame read bases per strand at requested positions', () => {
  // ref:        100 101 102 103
  // fwd read 1:  C   G   T   A   (all match)
  // rev read 2:  C   G   T   A
  const reads = [
    read({ start: 100, seq: 'CGTA', CIGAR: '4M' }),
    read({ start: 100, seq: 'CGTA', CIGAR: '4M', flags: 16 }),
  ]
  const counts = computeReadBaseCounts(reads, new Set([100, 102]))
  expect(counts.get(100)).toEqual({ C: { fwd: 1, rev: 1 } })
  expect(counts.get(102)).toEqual({ T: { fwd: 1, rev: 1 } })
  // Position 101 was not requested, so it is not tallied.
  expect(counts.get(101)).toBeUndefined()
})

test('a SNP read contributes its actual base, not the reference', () => {
  // Two reads cover position 100: one shows C, one shows T (a SNP).
  const reads = [
    read({ start: 100, seq: 'C', CIGAR: '1M' }),
    read({ start: 100, seq: 'T', CIGAR: '1M' }),
  ]
  const counts = computeReadBaseCounts(reads, new Set([100]))
  expect(counts.get(100)).toEqual({
    C: { fwd: 1, rev: 0 },
    T: { fwd: 1, rev: 0 },
  })
})

test('CIGAR indels/clips keep read- and ref-position in sync', () => {
  // 2M 1I 2M against ref starting at 100: the inserted base must not shift the
  // genomic mapping of bases after it.
  // read:  A C [G] T A   (G is an insertion)
  // ref:  100 101   102 103
  const reads = [read({ start: 100, seq: 'ACGTA', CIGAR: '2M1I2M' })]
  const counts = computeReadBaseCounts(reads, new Set([100, 101, 102, 103]))
  expect(counts.get(100)).toEqual({ A: { fwd: 1, rev: 0 } })
  expect(counts.get(101)).toEqual({ C: { fwd: 1, rev: 0 } })
  expect(counts.get(102)).toEqual({ T: { fwd: 1, rev: 0 } })
  expect(counts.get(103)).toEqual({ A: { fwd: 1, rev: 0 } })
})
