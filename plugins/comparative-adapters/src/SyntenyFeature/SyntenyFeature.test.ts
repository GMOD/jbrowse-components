import { DELETION_TYPE, INSERTION_TYPE } from '@jbrowse/cigar-utils'

import SyntenyFeature from './index.ts'

function collect(
  data: Record<string, unknown>,
  windowStart?: number,
  windowEnd?: number,
) {
  const out: { type: number; start: number; length: number }[] = []
  new SyntenyFeature({
    uniqueId: 'f1',
    refName: 'chr1',
    start: 1000,
    end: 3000,
    ...data,
  }).forEachMismatch(
    (type, start, length) => {
      out.push({ type, start, length })
    },
    { start: windowStart, end: windowEnd },
  )
  return out
}

describe('forEachMismatch window clipping', () => {
  // 100M 500D 100M: a deletion wider than the viewport, viewed from inside it.
  // Clipping on the deletion's start alone dropped it exactly there.
  test('keeps a deletion spanning the whole window', () => {
    expect(collect({ CIGAR: '100M500D100M' }, 1200, 1300)).toEqual([
      { type: DELETION_TYPE, start: 100, length: 500 },
    ])
  })

  test('drops a deletion that ends before the window', () => {
    expect(collect({ CIGAR: '100M500D100M' }, 2000, 2100)).toEqual([])
  })

  test('keeps an insertion inside the window and drops one outside', () => {
    expect(collect({ CIGAR: '100M50I100M' }, 1050, 1150)).toEqual([
      { type: INSERTION_TYPE, start: 100, length: 0 },
    ])
    expect(collect({ CIGAR: '100M50I100M' }, 1150, 1200)).toEqual([])
  })

  // the cs path already used the overlap test; both paths must agree
  test('the cs path agrees with the CIGAR path on a spanning deletion', () => {
    expect(collect({ cs: ':100-aaaaa:100' }, 1102, 1103)).toEqual([
      { type: DELETION_TYPE, start: 100, length: 5 },
    ])
  })
})
