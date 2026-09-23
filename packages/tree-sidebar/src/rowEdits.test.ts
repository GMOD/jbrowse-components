import { rowEdits } from './rowEdits.ts'

import type { RowSource } from './types.ts'

// The adapter says `a` is "Ay"; the config relabels `c` and colours `c` and
// `a`, so the dialog shows `a` in blue and `c` as "Sea" in green.
const adapter: RowSource[] = [
  { name: 'a', label: 'Ay' },
  { name: 'b' },
  { name: 'c' },
]
const shown: RowSource[] = [
  { name: 'a', label: 'Ay', color: '#00f' },
  { name: 'b' },
  { name: 'c', label: 'Sea', color: '#0f0' },
]
const live = {
  shown,
  adapter,
  labels: { c: 'Sea' },
  colors: new Map([
    ['c', '#0f0'],
    ['a', '#00f'],
  ]),
  baseOrder: ['c', 'a'],
  identityChannel: 'color' as const,
  rowAlias: undefined,
}

test('an unchanged submit writes the config back as it was', () => {
  const { labels, rowColor } = rowEdits({ ...live, rows: shown })
  expect(labels).toEqual({ c: 'Sea' })
  expect(rowColor).toEqual({ domain: ['c', 'a'], range: ['#0f0', '#00f'] })
})

// A config entry that repeats the adapter's value is the config's, so a
// submit that leaves the row alone keeps it.
test('an entry equal to the adapter value stands while the row is unchanged', () => {
  const { labels } = rowEdits({
    ...live,
    labels: { a: 'Ay' },
    rows: shown,
  })
  expect(labels).toEqual({ a: 'Ay' })
})

test('a row the dialog never showed keeps its label and colour', () => {
  const { labels, rowColor } = rowEdits({
    ...live,
    rows: [shown[0]!, shown[1]!],
  })
  expect(labels).toEqual({ c: 'Sea' })
  expect(rowColor).toEqual({ domain: ['c', 'a'], range: ['#0f0', '#00f'] })
})

test('a changed row is written as the reader left it', () => {
  const { labels, rowColor } = rowEdits({
    ...live,
    rows: [shown[0]!, { name: 'b', label: 'Bee', color: '#f00' }, shown[2]!],
  })
  expect(labels).toEqual({ c: 'Sea', b: 'Bee' })
  expect(rowColor).toEqual({
    domain: ['c', 'a', 'b'],
    range: ['#0f0', '#00f', '#f00'],
  })
})

test('a value changed back to the adapter one removes the entry', () => {
  const { labels, rowColor } = rowEdits({
    ...live,
    rows: [{ name: 'a', label: 'Ay' }, shown[1]!, { name: 'c', color: '#0f0' }],
  })
  expect(labels).toEqual({})
  expect(rowColor).toEqual({ domain: ['c'], range: ['#0f0'] })
})

test('a colour the painters cannot parse is left out', () => {
  const { rowColor } = rowEdits({
    ...live,
    rows: [{ ...shown[0]!, color: 'reddish' }],
  })
  expect(rowColor).toEqual({ domain: ['c'], range: ['#0f0'] })
})

// A haplotype row shows its sample's entry until it has one of its own, so a
// value changed back to the sample's removes the row's own entry.
test('a row answering to an alias falls back to the alias entry', () => {
  const { labels } = rowEdits({
    ...live,
    shown: [{ name: 'S1 HP0', label: 'Own' }],
    adapter: [{ name: 'S1 HP0' }],
    labels: { S1: 'Sample', 'S1 HP0': 'Own' },
    colors: new Map(),
    baseOrder: [],
    rowAlias: name => name.replace(/ HP\d+$/, ''),
    rows: [{ name: 'S1 HP0', label: 'Sample' }],
  })
  expect(labels).toEqual({ S1: 'Sample' })
})
