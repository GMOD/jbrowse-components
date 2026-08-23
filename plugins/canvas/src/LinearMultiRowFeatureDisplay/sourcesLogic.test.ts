import { categoricalPalette } from '@jbrowse/core/ui/colors'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import { orderPartitionValues, resolveRowColors } from './sourcesLogic.ts'

const rows = [{ name: 'mom' }, { name: 'dad' }, { name: 'kid' }]

test('resolveRowColors: default color slot → palette by display index', () => {
  expect(resolveRowColors(rows, {}, true)).toEqual([
    cssColorToABGR(categoricalPalette[0]!),
    cssColorToABGR(categoricalPalette[1]!),
    cssColorToABGR(categoricalPalette[2]!),
  ])
})

test('resolveRowColors: customized color slot → no palette (per-feature wins)', () => {
  expect(resolveRowColors(rows, {}, false)).toEqual([
    undefined,
    undefined,
    undefined,
  ])
})

test('resolveRowColors: sampleColorMap beats palette, per row', () => {
  expect(resolveRowColors(rows, { dad: 'blue' }, true)).toEqual([
    cssColorToABGR(categoricalPalette[0]!),
    cssColorToABGR('blue'),
    cssColorToABGR(categoricalPalette[2]!),
  ])
})

test("resolveRowColors: a row's own color (dialog) beats sampleColorMap", () => {
  const edited = [{ name: 'mom', color: 'black' }, { name: 'dad' }]
  expect(resolveRowColors(edited, { mom: 'red', dad: 'blue' }, true)).toEqual([
    cssColorToABGR('black'),
    cssColorToABGR('blue'),
  ])
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
