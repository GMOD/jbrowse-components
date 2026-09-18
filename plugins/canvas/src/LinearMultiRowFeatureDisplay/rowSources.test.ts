import { categoricalPalette } from '@jbrowse/core/ui/colors'

import { orderPartitionValues, resolveRowColorStrings } from './rowSources.ts'

const rows = [{ name: 'mom' }, { name: 'dad' }, { name: 'kid' }]

test('resolveRowColorStrings: default color slot → palette by discovery order', () => {
  expect(resolveRowColorStrings(rows, {}, rows)).toEqual([
    categoricalPalette[0],
    categoricalPalette[1],
    categoricalPalette[2],
  ])
})

test('resolveRowColorStrings: a reordered row keeps its color', () => {
  const reordered = [rows[2]!, rows[0]!, rows[1]!]
  expect(resolveRowColorStrings(reordered, {}, rows)).toEqual([
    categoricalPalette[2],
    categoricalPalette[0],
    categoricalPalette[1],
  ])
})

test('resolveRowColorStrings: customized color slot → no palette (per-feature wins)', () => {
  expect(resolveRowColorStrings(rows, {}, undefined)).toEqual([
    undefined,
    undefined,
    undefined,
  ])
})

test('resolveRowColorStrings: sampleColorMap beats palette, per row', () => {
  expect(resolveRowColorStrings(rows, { dad: 'blue' }, rows)).toEqual([
    categoricalPalette[0],
    'blue',
    categoricalPalette[2],
  ])
})

test("resolveRowColorStrings: a row's own color (dialog) beats sampleColorMap", () => {
  const edited = [{ name: 'mom', color: 'black' }, { name: 'dad' }]
  expect(
    resolveRowColorStrings(edited, { mom: 'red', dad: 'blue' }, edited),
  ).toEqual(['black', 'blue'])
})

test('empty domain = sorted', () => {
  expect(orderPartitionValues(new Set(['c', 'a', 'b']), [])).toEqual([
    'a',
    'b',
    'c',
  ])
})

test('domain values come first in order, rest sorted', () => {
  expect(
    orderPartitionValues(new Set(['c', 'a', 'b', 'd']), ['d', 'b']),
  ).toEqual(['d', 'b', 'a', 'c'])
})

test('domain entries not present in data are skipped', () => {
  expect(orderPartitionValues(new Set(['a', 'b']), ['z', 'b'])).toEqual([
    'b',
    'a',
  ])
})

test('duplicate domain entries are de-duplicated (no blank row)', () => {
  expect(orderPartitionValues(new Set(['a', 'b']), ['a', 'a', 'b'])).toEqual([
    'a',
    'b',
  ])
})

test('numeric partition values sort numerically, not lexicographically', () => {
  // A chromHMM state column: plain string order files 10 and 11 between 1 and
  // 2.
  expect(
    orderPartitionValues(new Set(['10', '2', '1', '20', '11', '3']), []),
  ).toEqual(['1', '2', '3', '10', '11', '20'])
})

test('a mixed numeric/text partition column still orders every value', () => {
  expect(
    orderPartitionValues(new Set(['10', 'Quies', '2', 'TssA']), []),
  ).toEqual(['2', '10', 'Quies', 'TssA'])
})

test('the features carrying no value file last, after every real value', () => {
  expect(orderPartitionValues(new Set(['', 'b', '10', 'a']), [])).toEqual([
    '10',
    'a',
    'b',
    '',
  ])
})

test('domain may still pin the empty value where it says', () => {
  expect(orderPartitionValues(new Set(['', 'a']), ['', 'a'])).toEqual(['', 'a'])
})
