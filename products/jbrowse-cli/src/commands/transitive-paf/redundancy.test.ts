/**
 * @jest-environment node
 */
import { dropRedundant } from './redundancy.ts'

import type { PafRow } from './paf.ts'

const row = (qname: string, qstart: number, qend: number): PafRow => ({
  qname,
  qlen: 1_000_000,
  qstart,
  qend,
  strand: '+',
  tname: 'B#1#chr1',
  tlen: 1_000_000,
  tstart: qstart,
  tend: qend,
  numMatches: qend - qstart,
  blockLen: qend - qstart,
  mappingQual: 60,
  cigar: `${qend - qstart}M`,
  identity: 1,
  tags: [],
})

const spans = (rows: PafRow[]) => rows.map(r => [r.qstart, r.qend])

test('keeps a single alignment', () => {
  const rows = [row('A#1#chr1', 0, 1000)]
  expect(dropRedundant(rows, 0.5)).toEqual(rows)
})

// the pileup case: many alignments restating one locus, which is what
// composition through a repeat produces by the thousand
test('collapses a pile of alignments over the same ground to the longest', () => {
  const rows = [
    row('A#1#chr1', 100, 900),
    row('A#1#chr1', 0, 1000),
    row('A#1#chr1', 200, 800),
    row('A#1#chr1', 50, 950),
  ]
  expect(spans(dropRedundant(rows, 0.5))).toEqual([[0, 1000]])
})

// genuine paralogy is uncovered ground, so it survives
test('keeps a second copy at a different locus', () => {
  const rows = [row('A#1#chr1', 0, 1000), row('A#1#chr1', 5000, 6000)]
  expect(spans(dropRedundant(rows, 0.5))).toEqual([
    [0, 1000],
    [5000, 6000],
  ])
})

// a long block plus a short one that mostly reaches past it
test('keeps an alignment that mostly reaches new ground', () => {
  const rows = [row('A#1#chr1', 0, 1000), row('A#1#chr1', 900, 1900)]
  expect(spans(dropRedundant(rows, 0.5))).toHaveLength(2)
})

test('drops an alignment that mostly does not', () => {
  const rows = [row('A#1#chr1', 0, 1000), row('A#1#chr1', 100, 1100)]
  expect(spans(dropRedundant(rows, 0.5))).toEqual([[0, 1000]])
})

// different query sequences never cover each other
test('coverage is tracked per query sequence', () => {
  const rows = [row('A#1#chr1', 0, 1000), row('A#2#chr1', 0, 1000)]
  expect(dropRedundant(rows, 0.5)).toHaveLength(2)
})

test('a threshold of 1 keeps everything', () => {
  const rows = [
    row('A#1#chr1', 0, 1000),
    row('A#1#chr1', 0, 1000),
    row('A#1#chr1', 100, 900),
  ]
  expect(dropRedundant(rows, 1)).toEqual(rows)
})

// the file stays in the order it was composed in, so make-pif's sort finds it
// nearly ordered rather than shuffled longest-first
test('survivors keep their original order', () => {
  const rows = [
    row('A#1#chr1', 5000, 6000),
    row('A#1#chr1', 0, 4000),
    row('A#1#chr1', 100, 900),
  ]
  expect(spans(dropRedundant(rows, 0.5))).toEqual([
    [5000, 6000],
    [0, 4000],
  ])
})

// which rows survive must not depend on the order they arrived in
test('the same set survives whatever order the rows arrive in', () => {
  const rows = [
    row('A#1#chr1', 0, 1000),
    row('A#1#chr1', 100, 900),
    row('A#1#chr1', 5000, 6000),
    row('A#1#chr1', 5100, 5900),
  ]
  const forward = spans(dropRedundant(rows, 0.5)).sort()
  const backward = spans(dropRedundant([...rows].reverse(), 0.5)).sort()
  expect(forward).toEqual(backward)
})
