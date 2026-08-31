import { categoricalPalette } from '@jbrowse/core/ui/colors'

import { orderPartitionValues, resolveRowColorStrings } from './sourcesLogic.ts'

const rows = [{ name: 'mom' }, { name: 'dad' }, { name: 'kid' }]

test('resolveRowColorStrings: default color slot → palette by display index', () => {
  expect(resolveRowColorStrings(rows, {}, true)).toEqual([
    categoricalPalette[0],
    categoricalPalette[1],
    categoricalPalette[2],
  ])
})

test('resolveRowColorStrings: customized color slot → no palette (per-feature wins)', () => {
  expect(resolveRowColorStrings(rows, {}, false)).toEqual([
    undefined,
    undefined,
    undefined,
  ])
})

test('resolveRowColorStrings: sampleColorMap beats palette, per row', () => {
  expect(resolveRowColorStrings(rows, { dad: 'blue' }, true)).toEqual([
    categoricalPalette[0],
    'blue',
    categoricalPalette[2],
  ])
})

test("resolveRowColorStrings: a row's own color (dialog) beats sampleColorMap", () => {
  const edited = [{ name: 'mom', color: 'black' }, { name: 'dad' }]
  expect(
    resolveRowColorStrings(edited, { mom: 'red', dad: 'blue' }, true),
  ).toEqual(['black', 'blue'])
})

test('empty rowOrder = sorted', () => {
  expect(orderPartitionValues(new Set(['c', 'a', 'b']), [])).toEqual([
    'a',
    'b',
    'c',
  ])
})

test('rowOrder values come first in order, rest sorted', () => {
  expect(
    orderPartitionValues(new Set(['c', 'a', 'b', 'd']), ['d', 'b']),
  ).toEqual(['d', 'b', 'a', 'c'])
})

test('rowOrder entries not present in data are skipped', () => {
  expect(orderPartitionValues(new Set(['a', 'b']), ['z', 'b'])).toEqual([
    'b',
    'a',
  ])
})

test('duplicate rowOrder entries are de-duplicated (no blank row)', () => {
  expect(orderPartitionValues(new Set(['a', 'b']), ['a', 'a', 'b'])).toEqual([
    'a',
    'b',
  ])
})

test('numeric partition values sort numerically, not lexicographically', () => {
  // a chromHMM state column: plain string order files 10 and 11 between 1 and 2
  expect(
    orderPartitionValues(new Set(['10', '2', '1', '20', '11', '3']), []),
  ).toEqual(['1', '2', '3', '10', '11', '20'])
})

test('a mixed numeric/text partition column still orders every value', () => {
  expect(
    orderPartitionValues(new Set(['10', 'Quies', '2', 'TssA']), []),
  ).toEqual(['2', '10', 'Quies', 'TssA'])
})
