import { computeSyriTypes } from './syriUtils'

import type { SyriType } from './syriUtils'

function rec(
  qname: string,
  qstart: number,
  qend: number,
  tname: string,
  tstart: number,
  tend: number,
  strand = 1,
) {
  return { qname, qstart, qend, tname, tstart, tend, strand }
}

test('classifies simple syntenic alignments', () => {
  const records = [
    rec('chr1', 0, 1000, 'chr1', 0, 1000),
    rec('chr1', 1000, 2000, 'chr1', 1000, 2000),
    rec('chr1', 2000, 3000, 'chr1', 2000, 3000),
  ]
  expect(computeSyriTypes(records)).toEqual(['SYN', 'SYN', 'SYN'])
})

test('detects inversions (negative strand)', () => {
  const records = [
    rec('chr1', 0, 1000, 'chr1', 0, 1000),
    rec('chr1', 1000, 2000, 'chr1', 1000, 2000, -1),
    rec('chr1', 2000, 3000, 'chr1', 2000, 3000),
  ]
  expect(computeSyriTypes(records)).toEqual(['SYN', 'INV', 'SYN'])
})

test('detects translocations (different target chromosome)', () => {
  const records = [
    rec('chr1', 0, 5000, 'chr1', 0, 5000),
    rec('chr1', 5000, 6000, 'chr2', 0, 1000),
    rec('chr2', 0, 3000, 'chr2', 0, 3000),
  ]
  const types = computeSyriTypes(records)
  expect(types[0]).toBe('SYN')
  // chr1's primary target is chr1 (5000bp > 1000bp), so mapping to chr2 is TRANS
  expect(types[1]).toBe('TRANS')
  expect(types[2]).toBe('SYN')
})

test('detects duplications (overlapping target regions)', () => {
  const records = [
    rec('chr1', 0, 1000, 'chr1', 0, 2000),
    rec('chr1', 3000, 4000, 'chr1', 1000, 2500),
  ]
  const types = computeSyriTypes(records)
  expect(types[0]).toBe('SYN')
  // Second alignment overlaps first on target chromosome
  expect(types[1]).toBe('DUP')
})

test('handles mixed types', () => {
  const records = [
    rec('chr1', 0, 5000, 'chr1', 0, 5000),
    rec('chr1', 5000, 6000, 'chr1', 5000, 6000, -1),
    rec('chr1', 6000, 7000, 'chr2', 0, 1000),
    rec('chr2', 0, 3000, 'chr2', 3000, 6000),
    rec('chr2', 3000, 4000, 'chr2', 5000, 6500),
  ]
  const types = computeSyriTypes(records)
  expect(types[0]).toBe('SYN')
  expect(types[1]).toBe('INV')
  expect(types[2]).toBe('TRANS')
  expect(types[3]).toBe('SYN')
  // chr2 rec at 5000-6500 overlaps with 3000-6000
  expect(types[4]).toBe('DUP')
})

test('handles empty input', () => {
  expect(computeSyriTypes([])).toEqual([])
})

test('single alignment is syntenic', () => {
  const records = [rec('chr1', 0, 1000, 'chr1', 0, 1000)]
  expect(computeSyriTypes(records)).toEqual(['SYN'])
})

test('negative strand on non-primary target is translocation not inversion', () => {
  const records = [
    rec('chr1', 0, 10000, 'chr1', 0, 10000),
    rec('chr1', 10000, 11000, 'chr2', 0, 1000, -1),
  ]
  const types = computeSyriTypes(records)
  expect(types[1]).toBe('TRANS')
})
