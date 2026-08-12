import { SAM_FLAG_REVERSE } from '@jbrowse/cigar-utils'

import { computeReadBaseCounts } from './readBaseCounts.ts'

import type { Feature } from '@jbrowse/core/util'

// Minimal Feature stub: only the fields computeReadBaseCounts reads. `strand` is
// derived from the reverse flag rather than taken as its own input, because that
// is what an adapter feature does (SamRecordFeature.strand) — a stub carrying
// one without the other is a shape no source produces, and it would let a
// strand read and a flag read disagree here in a way they never can in practice.
function read(over: {
  start: number
  seq: string
  CIGAR: string
  flags?: number
}): Feature {
  const flags = over.flags ?? 0
  const fields: Record<string, unknown> = {
    ...over,
    flags,
    strand: flags & SAM_FLAG_REVERSE ? -1 : 1,
  }
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

// Membership comes off a bitmap covering [min, max] of the requested positions,
// so anything outside that span has to be rejected before the bitmap is indexed.
// The tests above all sit a read inside the span; these put one across and
// outside the edges, where an off-by-one would drop a real tally or read past
// the end of the array.
describe('positions outside the bitmap span', () => {
  test('counts the boundary positions themselves', () => {
    // read covers 100-104; only the two ends are requested, so both are exactly
    // on the clamp boundary
    const reads = [read({ start: 100, seq: 'ACGTA', CIGAR: '5M' })]
    const counts = computeReadBaseCounts(reads, new Set([100, 104]))
    expect(counts.get(100)).toEqual({ A: { fwd: 1, rev: 0 } })
    expect(counts.get(104)).toEqual({ A: { fwd: 1, rev: 0 } })
    expect(counts.size).toBe(2)
  })

  test('a read overhanging both ends still tallies the middle', () => {
    // the geometry this exists for: the read is far longer than the span, so
    // most of the walk is outside it
    const reads = [read({ start: 100, seq: 'A'.repeat(50), CIGAR: '50M' })]
    const counts = computeReadBaseCounts(reads, new Set([120, 121]))
    expect(counts.get(120)).toEqual({ A: { fwd: 1, rev: 0 } })
    expect(counts.get(121)).toEqual({ A: { fwd: 1, rev: 0 } })
    expect(counts.size).toBe(2)
  })

  test('a read entirely outside the span contributes nothing', () => {
    const reads = [read({ start: 500, seq: 'ACGT', CIGAR: '4M' })]
    expect(computeReadBaseCounts(reads, new Set([100, 101])).size).toBe(0)
  })

  test('an insertion before the span keeps the mapping aligned', () => {
    // the clamp skips bases by reference offset while `seq` is indexed by read
    // offset, so a preceding insertion is where the two could drift apart
    // read:  A C [GG] T A
    // ref:  100 101     102 103
    const reads = [read({ start: 100, seq: 'ACGGTA', CIGAR: '2M2I2M' })]
    const counts = computeReadBaseCounts(reads, new Set([103]))
    expect(counts.get(103)).toEqual({ A: { fwd: 1, rev: 0 } })
  })

  test('no requested positions means no counts', () => {
    const reads = [read({ start: 100, seq: 'ACGT', CIGAR: '4M' })]
    expect(computeReadBaseCounts(reads, new Set()).size).toBe(0)
  })

  test('a span too wide for the bitmap still counts correctly', () => {
    // over MAX_BITMAP_SPAN, so the fallback membership test runs; the clamp is
    // still in force and the answer must not change
    const reads = [read({ start: 100, seq: 'ACGT', CIGAR: '4M' })]
    const counts = computeReadBaseCounts(reads, new Set([101, 90_000_000]))
    expect(counts.get(101)).toEqual({ C: { fwd: 1, rev: 0 } })
    expect(counts.size).toBe(1)
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
