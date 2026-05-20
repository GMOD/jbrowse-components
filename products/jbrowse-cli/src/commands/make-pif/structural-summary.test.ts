import { mergeIntoStructuralBlocks } from './structural-summary.ts'

import type { AlignmentRecord } from './structural-summary.ts'

function rec(
  qname: string,
  qstart: number,
  qend: number,
  tname: string,
  tstart: number,
  tend: number,
  strand = '+',
  numMatches = 100,
  blockLen = 100,
): AlignmentRecord {
  return {
    qname,
    qlen: '10000',
    qstart,
    qend,
    strand,
    tname,
    tlen: '10000',
    tstart,
    tend,
    numMatches,
    blockLen,
  }
}

test('merges adjacent same-type alignments within gap threshold', () => {
  const records = [
    rec('chr1', 0, 1000, 'chr1', 0, 1000),
    rec('chr1', 1000, 2000, 'chr1', 1000, 2000),
    rec('chr1', 2000, 3000, 'chr1', 2000, 3000),
  ]
  const blocks = mergeIntoStructuralBlocks(records, 50000)
  // All SYN on same chromosomes within gap -> merged into 1
  expect(blocks.length).toBe(1)
  expect(blocks[0]!.syriType).toBe('SYN')
  expect(blocks[0]!.tstart).toBe(0)
  expect(blocks[0]!.tend).toBe(3000)
})

test('does not merge alignments separated by large gap', () => {
  const records = [
    rec('chr1', 0, 1000, 'chr1', 0, 1000),
    rec('chr1', 200000, 201000, 'chr1', 200000, 201000),
  ]
  const blocks = mergeIntoStructuralBlocks(records, 50000)
  expect(blocks.length).toBe(2)
})

test('separates different syri types', () => {
  const records = [
    rec('chr1', 0, 5000, 'chr1', 0, 5000),
    rec('chr1', 5000, 6000, 'chr1', 5000, 6000, '-'),
  ]
  const blocks = mergeIntoStructuralBlocks(records, 50000)
  // SYN and INV should be separate blocks
  const types = blocks.map(b => b.syriType).sort()
  expect(types).toContain('SYN')
  expect(types).toContain('INV')
})

test('handles empty input', () => {
  expect(mergeIntoStructuralBlocks([], 50000)).toEqual([])
})

test('computes mean identity from merged records', () => {
  const records = [
    rec('chr1', 0, 1000, 'chr1', 0, 1000, '+', 90, 100),
    rec('chr1', 1000, 2000, 'chr1', 1000, 2000, '+', 80, 100),
  ]
  const blocks = mergeIntoStructuralBlocks(records, 50000)
  expect(blocks.length).toBe(1)
  // (90+80)/(100+100) = 0.85
  expect(blocks[0]!.meanIdentity).toBeCloseTo(0.85, 2)
})

test('prefers de when present (CIGAR-derived identity)', () => {
  // numMatches says 50% identity but de says 99% — de should win.
  const records: AlignmentRecord[] = [
    { ...rec('chr1', 0, 1000, 'chr1', 0, 1000, '+', 50, 100), de: 0.01 },
    { ...rec('chr1', 1000, 2000, 'chr1', 1000, 2000, '+', 50, 100), de: 0.03 },
  ]
  const blocks = mergeIntoStructuralBlocks(records, 50000)
  expect(blocks.length).toBe(1)
  // ((1-0.01)*100 + (1-0.03)*100) / 200 = 0.98
  expect(blocks[0]!.meanIdentity).toBeCloseTo(0.98, 2)
})

test('falls back to numMatches when de is missing', () => {
  const records: AlignmentRecord[] = [
    { ...rec('chr1', 0, 1000, 'chr1', 0, 1000, '+', 90, 100), de: 0.05 },
    rec('chr1', 1000, 2000, 'chr1', 1000, 2000, '+', 80, 100),
  ]
  const blocks = mergeIntoStructuralBlocks(records, 50000)
  expect(blocks.length).toBe(1)
  // ((1-0.05)*100 + 80) / 200 = 0.875
  expect(blocks[0]!.meanIdentity).toBeCloseTo(0.875, 3)
})
