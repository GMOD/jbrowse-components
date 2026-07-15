import { tagColorPalette } from '@jbrowse/core/ui/theme'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import {
  buildEditableSources,
  buildSources,
  orderPartitionValues,
  resolveRowColors,
} from './sourcesLogic.ts'

const rows = [{ name: 'mom' }, { name: 'dad' }, { name: 'kid' }]

test('resolveRowColors: default color slot → palette by display index', () => {
  expect(resolveRowColors(rows, {}, true)).toEqual([
    cssColorToABGR(tagColorPalette[0]!),
    cssColorToABGR(tagColorPalette[1]!),
    cssColorToABGR(tagColorPalette[2]!),
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
    cssColorToABGR(tagColorPalette[0]!),
    cssColorToABGR('blue'),
    cssColorToABGR(tagColorPalette[2]!),
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

const discovered = [{ name: 'mom' }, { name: 'dad' }, { name: 'kid' }]

test('buildEditableSources: empty layout returns discovered unchanged', () => {
  expect(buildEditableSources(discovered, [])).toBe(discovered)
})

test('buildEditableSources: layout reorders discovered rows', () => {
  const layout = [{ name: 'kid' }, { name: 'mom' }, { name: 'dad' }]
  expect(buildEditableSources(discovered, layout)).toEqual([
    { name: 'kid' },
    { name: 'mom' },
    { name: 'dad' },
  ])
})

test('buildEditableSources: layout rows no longer in the data are dropped', () => {
  const layout = [{ name: 'gone' }, { name: 'dad' }]
  expect(buildEditableSources(discovered, layout)).toEqual([
    { name: 'dad' },
    { name: 'mom' },
    { name: 'kid' },
  ])
})

test('buildEditableSources: newly-discovered rows append in discovered order', () => {
  const layout = [{ name: 'dad' }]
  expect(buildEditableSources(discovered, layout)).toEqual([
    { name: 'dad' },
    { name: 'mom' },
    { name: 'kid' },
  ])
})

test('buildEditableSources: layout label/color overrides merge over discovered', () => {
  const layout = [{ name: 'mom', label: 'Mother', color: 'red' }]
  expect(buildEditableSources(discovered, layout)).toEqual([
    { name: 'mom', label: 'Mother', color: 'red' },
    { name: 'dad' },
    { name: 'kid' },
  ])
})

test('buildSources: no filter returns editable unchanged', () => {
  expect(buildSources(discovered, undefined)).toBe(discovered)
  expect(buildSources(discovered, [])).toBe(discovered)
})

test('buildSources: filter narrows to the named subset, keeping order', () => {
  expect(buildSources(discovered, ['kid', 'mom'])).toEqual([
    { name: 'mom' },
    { name: 'kid' },
  ])
})
