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
