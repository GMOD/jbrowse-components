import { rowOrderByValueAt } from './rowOrderByValueAt.ts'

import type { RowValueRegion } from './rowOrderByValueAt.ts'

// The rows being ordered: only `name` is read, so this stands in for the
// display's layout-merged sources.
function rows(...names: string[]) {
  return names.map(name => ({ name }))
}

function order(names: string[], region: RowValueRegion, pos: number) {
  return rowOrderByValueAt(rows(...names), region, pos).map(s => s.name)
}

// One region's wire arrays — the region the caller resolved as covering the
// column. Which region that is, is `loadedRegionIndexAt`'s question and is
// pinned in sortRowsMenu.test.ts against the real model.
function region(
  feats: { start: number; end: number; color: number; row: number }[],
  partitionValues: string[],
): RowValueRegion {
  return {
    featureStarts: new Uint32Array(feats.map(f => f.start)),
    featureEnds: new Uint32Array(feats.map(f => f.end)),
    featureColors: new Uint32Array(feats.map(f => f.color)),
    featurePartitionIndex: new Uint32Array(feats.map(f => f.row)),
    partitionValues,
  }
}

test('groups rows by the value at pos; absent rows sort last (stable)', () => {
  // a,c are "red" (color 1) at pos 50; b is "blue" (color 2); d has no feature
  const r = region(
    [
      { start: 0, end: 100, color: 1, row: 0 }, // a
      { start: 0, end: 100, color: 2, row: 1 }, // b
      { start: 0, end: 100, color: 1, row: 2 }, // c
    ],
    ['a', 'b', 'c'],
  )
  // reds (a,c) first in original order, then blue (b), then valueless (d)
  expect(order(['a', 'b', 'c', 'd'], r, 50)).toEqual(['a', 'c', 'b', 'd'])
})

test('puts the commonest block first, whatever its color packs to', () => {
  // b alone carries color 1; a,c,d share color 9. Ordering by the packed value
  // would lead with the singleton purely because 1 < 9 — an artifact of how the
  // color is stored, which also means a recolor would rearrange the same rows
  // over the same locus.
  const r = region(
    [
      { start: 0, end: 100, color: 9, row: 0 }, // a
      { start: 0, end: 100, color: 1, row: 1 }, // b
      { start: 0, end: 100, color: 9, row: 2 }, // c
      { start: 0, end: 100, color: 9, row: 3 }, // d
    ],
    ['a', 'b', 'c', 'd'],
  )
  expect(order(['a', 'b', 'c', 'd'], r, 50)).toEqual(['a', 'c', 'd', 'b'])
})

test('equal-sized blocks stay deterministic', () => {
  const r = region(
    [
      { start: 0, end: 100, color: 7, row: 0 }, // a
      { start: 0, end: 100, color: 3, row: 1 }, // b
    ],
    ['a', 'b'],
  )
  // nothing distinguishes a one-row block from another one-row block, so the
  // color value breaks the tie rather than leaving it to sort implementation
  expect(order(['a', 'b'], r, 50)).toEqual(['b', 'a'])
})

test('pos outside every feature leaves the original order', () => {
  const r = region(
    [
      { start: 0, end: 10, color: 1, row: 0 },
      { start: 0, end: 10, color: 2, row: 1 },
    ],
    ['a', 'b'],
  )
  expect(order(['a', 'b'], r, 500)).toEqual(['a', 'b'])
})
