/**
 * @jest-environment node
 */
import {
  alignmentBlocks,
  composeThroughPivot,
  orientToPivot,
} from './compose.ts'
import { parsePafRow } from './paf.ts'

import type { PafRow } from './paf.ts'

// col = qname qlen qstart qend strand tname tlen tstart tend nmatch blocklen mapq
const row = (parts: string, cigar: string, tags: string[] = []): PafRow =>
  parsePafRow(
    [parts, ...tags, `cg:Z:${cigar}`].join('\t').replaceAll(' ', '\t'),
  )!

/**
 * Walk a composed row the way the adapters do (CIGAR in target-forward order,
 * query consumed backwards on the `-` strand) and return the base pairs it
 * claims. The point of every test below is that these pairs are the ones the two
 * input alignments imply, so this is the oracle rather than the CIGAR string.
 */
function pairs(r: PafRow) {
  const out: [number, number][] = []
  for (const b of alignmentBlocks(r)) {
    for (let d = 0; d < b.len; d++) {
      out.push([b.q + b.step * d, b.t + d])
    }
  }
  return out
}

/** Every (query base, target base) an input row pairs, keyed for lookup. */
function pairMap(r: PafRow) {
  return new Map(pairs(r).map(([q, t]): [number, number] => [t, q]))
}

/**
 * The composition an all-vs-all file would contain if it stated A-vs-B
 * directly: for every pivot base both legs align, the A base and the B base that
 * meet on it.
 */
function expectedPairs(a: PafRow, b: PafRow) {
  const aByPivot = pairMap(a)
  const bByPivot = pairMap(b)
  const out: [number, number][] = []
  for (const [pivot, aBase] of [...aByPivot].sort((x, y) => x[0] - y[0])) {
    const bBase = bByPivot.get(pivot)
    if (bBase !== undefined) {
      out.push([aBase, bBase])
    }
  }
  return out.sort((x, y) => x[1] - y[1])
}

function expectComposesCorrectly(a: PafRow, b: PafRow) {
  const composed = composeThroughPivot({ a, b })!
  expect(composed).toBeDefined()
  expect(pairs(composed).sort((x, y) => x[1] - y[1])).toEqual(
    expectedPairs(a, b),
  )
  // the coordinate columns and the CIGAR have to agree, or the ribbon draws in
  // one place and its detail panel reports another
  const qs = pairs(composed).map(p => p[0])
  const ts = pairs(composed).map(p => p[1])
  expect(Math.min(...qs)).toBe(composed.qstart)
  expect(Math.max(...qs) + 1).toBe(composed.qend)
  expect(Math.min(...ts)).toBe(composed.tstart)
  expect(Math.max(...ts) + 1).toBe(composed.tend)
  return composed
}

describe('alignmentBlocks', () => {
  test('forward strand walks both axes up', () => {
    expect(
      alignmentBlocks(row('A 100 10 30 + R 100 50 70 20 20 60', '20M')),
    ).toEqual([{ t: 50, q: 10, step: 1, len: 20 }])
  })

  // PAF states qstart/qend on the original strand and walks the query backwards
  test('reverse strand walks the query down from qend', () => {
    expect(
      alignmentBlocks(row('A 100 10 30 - R 100 50 70 20 20 60', '20M')),
    ).toEqual([{ t: 50, q: 29, step: -1, len: 20 }])
  })

  test('a deletion advances the target only, an insertion the query only', () => {
    expect(
      alignmentBlocks(row('A 100 0 15 + R 100 0 20 15 20 60', '5M5D5M5I5M')),
    ).toEqual([
      { t: 0, q: 0, step: 1, len: 5 },
      { t: 10, q: 5, step: 1, len: 5 },
      { t: 15, q: 15, step: 1, len: 5 },
    ])
  })
})

describe('composeThroughPivot', () => {
  // The plain case: A and B both align cleanly to a shared stretch of R, so the
  // A-vs-B they imply is the intersection of the two on R.
  test('two forward ungapped legs', () => {
    const a = row('A 200 0 100 + R 200 100 200 100 100 60', '100M')
    const b = row('B 200 50 150 + R 200 100 200 100 100 60', '100M')
    const c = expectComposesCorrectly(a, b)
    expect(c.strand).toBe('+')
    expect(c.cigar).toBe('100M')
    expect([c.qname, c.tname]).toEqual(['A', 'B'])
  })

  // Only part of each leg is shared, so the composed row is the overlap alone
  test('partial overlap on the pivot yields only the shared part', () => {
    const a = row('A 500 0 200 + R 500 0 200 200 200 60', '200M')
    const b = row('B 500 0 200 + R 500 100 300 200 200 60', '200M')
    const c = expectComposesCorrectly(a, b)
    expect(c.cigar).toBe('100M')
    expect([c.qstart, c.qend]).toEqual([100, 200])
    expect([c.tstart, c.tend]).toEqual([0, 100])
  })

  // One leg inverted: the composition has to come out reverse-strand, with the
  // CIGAR still walking B forward while A runs down
  test('one reverse leg composes to a reverse-strand row', () => {
    const a = row('A 200 0 100 + R 200 0 100 100 100 60', '100M')
    const b = row('B 200 0 100 - R 200 0 100 100 100 60', '100M')
    const c = expectComposesCorrectly(a, b)
    expect(c.strand).toBe('-')
  })

  // Both inverted relative to the pivot means they agree with each other
  test('two reverse legs compose to a forward-strand row', () => {
    const a = row('A 200 0 100 - R 200 0 100 100 100 60', '100M')
    const b = row('B 200 0 100 - R 200 0 100 100 100 60', '100M')
    const c = expectComposesCorrectly(a, b)
    expect(c.strand).toBe('+')
  })

  // An indel in one leg becomes an indel of the opposite sense in the composed
  // row, which is the whole reason this walks blocks rather than splicing CIGARs
  test('a deletion in the A leg becomes an insertion in B', () => {
    // A skips 10 bases of R; B covers R contiguously, so relative to B, A is
    // missing 10 bases
    const a = row('A 300 0 90 + R 300 0 100 90 100 60', '40M10D50M')
    const b = row('B 300 0 100 + R 300 0 100 100 100 60', '100M')
    const c = expectComposesCorrectly(a, b)
    expect(c.cigar).toBe('40M10D50M')
  })

  test('an insertion in the A leg drops out of the composition entirely', () => {
    // the 10 inserted A bases pair with nothing on R, so they can pair with
    // nothing on B either
    const a = row('A 300 0 100 + R 300 0 90 90 100 60', '40M10I50M')
    const b = row('B 300 0 90 + R 300 0 90 90 90 60', '90M')
    const c = expectComposesCorrectly(a, b)
    expect(c.cigar).toBe('40M10I50M')
  })

  test('indels in both legs compose', () => {
    const a = row('A 300 0 90 + R 300 0 100 90 100 60', '40M10D50M')
    const b = row('B 300 0 95 + R 300 0 100 95 100 60', '70M5D25M')
    expectComposesCorrectly(a, b)
  })

  test('a reverse leg with an indel composes', () => {
    const a = row('A 300 0 90 + R 300 0 100 90 100 60', '40M10D50M')
    const b = row('B 300 0 95 - R 300 0 100 95 100 60', '70M5D25M')
    expectComposesCorrectly(a, b)
  })

  test('both legs reverse, both with indels', () => {
    const a = row('A 300 5 95 - R 300 0 100 90 100 60', '40M10D50M')
    const b = row('B 300 0 95 - R 300 0 100 95 100 60', '25M5D70M')
    expectComposesCorrectly(a, b)
  })

  test('legs that do not overlap on the pivot compose to nothing', () => {
    const a = row('A 500 0 100 + R 500 0 100 100 100 60', '100M')
    const b = row('B 500 0 100 + R 500 200 300 100 100 60', '100M')
    expect(composeThroughPivot({ a, b })).toBeUndefined()
  })

  test('an overlap shorter than minAligned is discarded', () => {
    const a = row('A 500 0 200 + R 500 0 200 200 200 60', '200M')
    const b = row('B 500 0 200 + R 500 190 390 200 200 60', '200M')
    expect(composeThroughPivot({ a, b, minAligned: 100 })).toBeUndefined()
    expect(composeThroughPivot({ a, b, minAligned: 10 })).toBeDefined()
  })

  // A composed row is derived, not measured: there is no sequence here to
  // recompute identity from, so it is the product of the two inputs' — and the
  // row says so, rather than passing itself off as an alignment.
  test('identity is the product of the two legs, and the pivot is named', () => {
    const a = row('A 200 0 100 + R 200 0 100 100 100 60', '100M', ['de:f:0.1'])
    const b = row('B 200 0 100 + R 200 0 100 100 100 60', '100M', ['de:f:0.2'])
    const c = composeThroughPivot({ a, b })!
    expect(c.identity).toBeCloseTo(0.72)
    expect(c.numMatches).toBe(72)
    expect(c.tags).toContain('de:f:0.280000')
    expect(c.tags).toContain('vi:Z:R')
  })

  test('mapping quality is the weaker of the two legs', () => {
    const a = row('A 200 0 100 + R 200 0 100 100 100 60', '100M')
    const b = row('B 200 0 100 + R 200 0 100 100 100 11', '100M')
    expect(composeThroughPivot({ a, b })!.mappingQual).toBe(11)
  })
})

describe('orientToPivot', () => {
  // A row reaches the composer with the pivot on whichever side the aligner put
  // it, so half of them have to be turned around first — and turning a row
  // around is not just a column swap, the CIGAR's indel sense goes with it.
  test('a row already anchored on the pivot passes through', () => {
    const r = row('A 200 0 100 + R 200 0 100 100 100 60', '100M')
    expect(orientToPivot(r, 'R')).toBe(r)
  })

  test('swapping sides preserves which bases pair with which', () => {
    // pivot is the QUERY here, so the row has to be turned around
    const r = row('R 300 0 100 + A 300 0 90 90 100 60', '40M10I50M')
    const flipped = orientToPivot(r, 'R')!
    expect(flipped.qname).toBe('A')
    expect(flipped.tname).toBe('R')
    // same base pairs, read from the other side
    expect(
      pairs(flipped)
        .map(([q, t]): [number, number] => [t, q])
        .sort((x, y) => x[0] - y[0]),
    ).toEqual(pairs(r).sort((x, y) => x[0] - y[0]))
  })

  test('swapping sides of a reverse-strand row preserves its base pairs', () => {
    const r = row('R 300 0 100 - A 300 0 90 90 100 60', '40M10I50M')
    const flipped = orientToPivot(r, 'R')!
    expect(
      pairs(flipped)
        .map(([q, t]): [number, number] => [t, q])
        .sort((x, y) => x[0] - y[0]),
    ).toEqual(pairs(r).sort((x, y) => x[0] - y[0]))
  })

  test('a row that does not touch the pivot is not usable', () => {
    expect(
      orientToPivot(row('A 200 0 100 + B 200 0 100 100 100 60', '100M'), 'R'),
    ).toBeUndefined()
  })
})
