import { rowOrderByValueAt } from './rowOrderByValueAt.ts'

import type { RowValueRegion } from './rowOrderByValueAt.ts'

function region(
  refName: string,
  feats: { start: number; end: number; color: number; row: number }[],
  partitionValues: string[],
): RowValueRegion {
  return {
    refName,
    featureStarts: new Uint32Array(feats.map(f => f.start)),
    featureEnds: new Uint32Array(feats.map(f => f.end)),
    featureColors: new Uint32Array(feats.map(f => f.color)),
    featurePartitionIndex: new Uint32Array(feats.map(f => f.row)),
    partitionValues,
  }
}

test('groups rows by the value at pos; absent rows sort last (stable)', () => {
  // a,c are "red" (color 1) at pos 50; b is "blue" (color 2); d has no feature
  const regions = [
    region(
      'chr4',
      [
        { start: 0, end: 100, color: 1, row: 0 }, // a
        { start: 0, end: 100, color: 2, row: 1 }, // b
        { start: 0, end: 100, color: 1, row: 2 }, // c
      ],
      ['a', 'b', 'c'],
    ),
  ]
  const order = rowOrderByValueAt(['a', 'b', 'c', 'd'], regions, 'chr4', 50)
  // reds (a,c) first in original order, then blue (b), then valueless (d)
  expect(order).toEqual(['a', 'c', 'b', 'd'])
})

test('ignores regions on other refNames (numeric pos overlap)', () => {
  const regions = [
    region('chr4', [{ start: 0, end: 100, color: 1, row: 0 }], ['a']),
    // chr5 also spans pos 50 numerically, but must not affect a chr4 sort
    region('chr5', [{ start: 0, end: 100, color: 9, row: 0 }], ['b']),
  ]
  const order = rowOrderByValueAt(['a', 'b'], regions, 'chr4', 50)
  // a has a chr4 value, b does not (its match is on chr5) → b sorts last
  expect(order).toEqual(['a', 'b'])
})

test('pos outside every feature leaves the original order', () => {
  const regions = [
    region(
      'chr4',
      [
        { start: 0, end: 10, color: 1, row: 0 },
        { start: 0, end: 10, color: 2, row: 1 },
      ],
      ['a', 'b'],
    ),
  ]
  expect(rowOrderByValueAt(['a', 'b'], regions, 'chr4', 500)).toEqual([
    'a',
    'b',
  ])
})
