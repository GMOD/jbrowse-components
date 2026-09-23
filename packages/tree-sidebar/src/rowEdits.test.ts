import { rowEdits } from './rowEdits.ts'

interface Row {
  name: string
  label?: string
  color?: string
}

const live = {
  labels: { c: 'Sea', a: 'Ay' },
  colors: new Map([
    ['c', '#0f0'],
    ['a', '#00f'],
  ]),
  baseOrder: ['c', 'a'],
  edited: (row: Row) => ({ label: row.label, color: row.color }),
}

test('a row the dialog never showed keeps its label and colour', () => {
  const { labels, rowColor } = rowEdits({
    ...live,
    rows: [{ name: 'a', label: 'Ay', color: '#00f' }, { name: 'b' }],
  })
  expect(labels).toEqual({ c: 'Sea', a: 'Ay' })
  expect(rowColor).toEqual({ domain: ['c', 'a'], range: ['#0f0', '#00f'] })
})

test('a shown row is written as the reader left it', () => {
  const { labels, rowColor } = rowEdits({
    ...live,
    rows: [{ name: 'a' }, { name: 'b', label: 'Bee', color: '#f00' }],
  })
  expect(labels).toEqual({ c: 'Sea', b: 'Bee' })
  expect(rowColor).toEqual({ domain: ['c', 'b'], range: ['#0f0', '#f00'] })
})

test('the pairs keep the declared order ahead of new names', () => {
  const { rowColor } = rowEdits({
    ...live,
    rows: [
      { name: 'b', color: '#f00' },
      { name: 'a', color: '#00f' },
      { name: 'c', color: '#0f0' },
    ],
  })
  expect(rowColor.domain).toEqual(['c', 'a', 'b'])
})

test('a colour the painters cannot parse is left out', () => {
  const { rowColor } = rowEdits({
    ...live,
    rows: [{ name: 'a', color: 'reddish' }],
  })
  expect(rowColor).toEqual({ domain: ['c'], range: ['#0f0'] })
})
