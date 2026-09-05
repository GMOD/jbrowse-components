import { rowOrderByValueAt } from './rowOrderByValueAt.ts'

import type { MultiRowFeaturePaintInputs } from './rendering/multiRowRenderingBackendTypes.ts'
import type { RowValueRegion } from './rowOrderByValueAt.ts'

function rows(...names: string[]) {
  return names.map(name => ({ name }))
}

function paintInputs(
  names: string[],
  opts: {
    hiddenColors?: Set<number>
    rowColorsByIndex?: (number | undefined)[]
  } = {},
): MultiRowFeaturePaintInputs {
  return {
    rowIndexByValue: new Map(names.map((name, i) => [name, i] as const)),
    rowColorsByIndex: opts.rowColorsByIndex ?? names.map(() => undefined),
    hiddenColors: opts.hiddenColors ?? new Set<number>(),
  }
}

function order(
  names: string[],
  region: RowValueRegion,
  pos: number,
  paint = paintInputs(names),
) {
  return rowOrderByValueAt(rows(...names), region, pos, paint).map(s => s.name)
}

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
  // a,c are "red" (color 1) at pos 50; b is "blue" (color 2); d has no
  // feature.
  const r = region(
    [
      { start: 0, end: 100, color: 1, row: 0 }, // a
      { start: 0, end: 100, color: 2, row: 1 }, // b
      { start: 0, end: 100, color: 1, row: 2 }, // c
    ],
    ['a', 'b', 'c'],
  )
  // Reds (a,c) first in original order, then blue (b), then valueless (d).
  expect(order(['a', 'b', 'c', 'd'], r, 50)).toEqual(['a', 'c', 'b', 'd'])
})

test('puts the commonest block first, whatever its color packs to', () => {
  // b alone carries color 1; a,c,d share color 9. Ordering by the packed value
  // would lead with the singleton purely because 1 < 9, so a recolor would
  // rearrange the same rows over the same locus.
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
  // Nothing distinguishes a one-row block from another, so the color value
  // breaks the tie rather than leaving it to the sort implementation.
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

test('a hidden legend category carries no value, and sinks its rows', () => {
  // a,c are the big red block; b is blue; d has nothing at pos.
  const r = region(
    [
      { start: 0, end: 100, color: 1, row: 0 }, // a
      { start: 0, end: 100, color: 2, row: 1 }, // b
      { start: 0, end: 100, color: 1, row: 2 }, // c
    ],
    ['a', 'b', 'c'],
  )
  const names = ['a', 'b', 'c', 'd']
  // Red visible: the two-row block leads.
  expect(order(names, r, 50)).toEqual(['a', 'c', 'b', 'd'])
  // Red toggled off in the legend paints nothing, so a and c sink with d rather
  // than leading on a block the user cannot see.
  expect(
    order(names, r, 50, paintInputs(names, { hiddenColors: new Set([1]) })),
  ).toEqual(['b', 'a', 'c', 'd'])
})

test('a hidden color does not overwrite the visible feature under it', () => {
  // Two features cover pos on row a and the later one is hidden, so what paints
  // there is still the earlier one and a stays in the blue block.
  const r = region(
    [
      { start: 0, end: 100, color: 2, row: 0 }, // a, visible
      { start: 0, end: 100, color: 1, row: 0 }, // a, hidden
      { start: 0, end: 100, color: 2, row: 1 }, // b
      { start: 0, end: 100, color: 2, row: 2 }, // c
    ],
    ['a', 'b', 'c'],
  )
  const names = ['a', 'b', 'c']
  expect(
    order(names, r, 50, paintInputs(names, { hiddenColors: new Set([1]) })),
  ).toEqual(['a', 'b', 'c'])
})

test('a row painting a per-row override is not hidden by its baked color', () => {
  // a and b are baked in the hidden color; a carries an arrangement-dialog
  // override, which the legend never lists, so a still paints.
  const r = region(
    [
      { start: 0, end: 100, color: 1, row: 0 }, // a
      { start: 0, end: 100, color: 1, row: 1 }, // b
      { start: 0, end: 100, color: 2, row: 2 }, // c
    ],
    ['a', 'b', 'c'],
  )
  const names = ['a', 'b', 'c']
  expect(
    order(
      names,
      r,
      50,
      paintInputs(names, {
        hiddenColors: new Set([1]),
        rowColorsByIndex: [0xff123456, undefined, undefined],
      }),
    ),
  ).toEqual(['a', 'c', 'b'])
})

test('a zero-length feature carries a value at the base it is painted from', () => {
  // b's only feature at pos 50 is an insertion, which both painters draw there,
  // so the sort has to read a value off it rather than sinking the row.
  const r = region(
    [
      { start: 0, end: 100, color: 1, row: 0 }, // a
      { start: 50, end: 50, color: 1, row: 1 }, // b
      { start: 0, end: 100, color: 2, row: 2 }, // c
    ],
    ['a', 'b', 'c'],
  )
  expect(order(['a', 'b', 'c'], r, 50)).toEqual(['a', 'b', 'c'])
  // One base past it the insertion is gone and b sinks.
  expect(order(['a', 'b', 'c'], r, 51)).toEqual(['a', 'c', 'b'])
})

// `sortRowsAtColumn` orders `editableSources`, which the subtree filter has not
// touched, so the list being ordered is not the list on screen: a clade focused
// down to three rows must not be ranked by the two thousand behind it.
test('sizes the blocks by the rows on screen, not the rows being ordered', () => {
  const r = region(
    [
      { start: 0, end: 100, color: 1, row: 0 }, // a
      { start: 0, end: 100, color: 1, row: 1 }, // b
      { start: 0, end: 100, color: 1, row: 2 }, // c
      { start: 0, end: 100, color: 2, row: 3 }, // d
      { start: 0, end: 100, color: 2, row: 4 }, // e
    ],
    ['a', 'b', 'c', 'd', 'e'],
  )
  // Unfiltered, color 1 is the bigger block and leads.
  expect(order(['a', 'b', 'c', 'd', 'e'], r, 50)).toEqual([
    'a',
    'b',
    'c',
    'd',
    'e',
  ])

  // With only a, d and e drawn, color 2 is the bigger block on screen, and the
  // rows the filter hides still come along in their own block.
  expect(
    rowOrderByValueAt(
      rows('a', 'b', 'c', 'd', 'e'),
      r,
      50,
      paintInputs(['a', 'd', 'e']),
    ).map(s => s.name),
  ).toEqual(['d', 'e', 'a', 'b', 'c'])
})
