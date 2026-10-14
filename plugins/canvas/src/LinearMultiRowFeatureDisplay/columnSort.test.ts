import { rowValuesAt } from '../MultiRowClusterFeaturesRPC/rowValuesAt.ts'
import { columnSortLabel, rowOrderByValues } from './columnSort.ts'

const rows = (...names: string[]) => names.map(name => ({ name }))
const names = (sources: { name: string }[]) => sources.map(s => s.name)

function order(
  sources: { name: string }[],
  values: Record<string, string>,
  shown = new Set(names(sources)),
) {
  return names(
    rowOrderByValues(sources, new Map(Object.entries(values)), shown),
  )
}

describe('rowOrderByValues', () => {
  test('numbers sort highest first, absent rows last in their order', () => {
    expect(
      order(rows('a', 'b', 'c', 'd'), { a: '2', c: '10', d: '-1' }),
    ).toEqual(['c', 'a', 'd', 'b'])
  })

  test('text groups into blocks, the largest first', () => {
    expect(
      order(rows('a', 'b', 'c', 'd', 'e'), {
        a: 'Quies',
        b: 'TssA',
        c: 'Quies',
        d: 'Enh',
        e: 'TssA',
      }).slice(0, 2),
    ).toEqual(['a', 'c'])
  })

  test('equal blocks fall back to the value order', () => {
    expect(
      order(rows('a', 'b', 'c'), { a: 'Tx', b: 'Quies', c: 'Enh' }),
    ).toEqual(['c', 'b', 'a'])
  })

  test('a feature with no value sorts between the values and the absent rows', () => {
    expect(order(rows('a', 'b', 'c'), { b: '', c: 'x' })).toEqual([
      'c',
      'b',
      'a',
    ])
  })

  test('presence: covered rows first, in their order', () => {
    expect(order(rows('a', 'b', 'c', 'd'), { b: '', d: '' })).toEqual([
      'b',
      'd',
      'a',
      'c',
    ])
  })

  test('one non-number puts the column on the text rule', () => {
    expect(order(rows('a', 'b', 'c'), { a: '2', b: 'NA', c: 'NA' })).toEqual([
      'b',
      'c',
      'a',
    ])
  })

  test('sizes the blocks by the rows on screen, not the rows being ordered', () => {
    // three hidden rows hold 'x', but only the shown 'y' pair reads as a block
    const sources = rows('h1', 'h2', 'h3', 'y1', 'y2')
    expect(
      order(
        sources,
        { h1: 'x', h2: 'x', h3: 'x', y1: 'y', y2: 'y' },
        new Set(['y1', 'y2']),
      ).slice(0, 2),
    ).toEqual(['y1', 'y2'])
  })
})

describe('rowValuesAt', () => {
  const feature = (row: string, start: number, end: number, value: string) => ({
    regionIndex: 0,
    row,
    start,
    end,
    value,
  })

  test('the last feature covering the base wins, as it paints', () => {
    expect(
      rowValuesAt(
        [
          feature('a', 0, 100, 'under'),
          feature('a', 40, 60, 'over'),
          feature('b', 0, 10, 'elsewhere'),
        ],
        50,
      ),
    ).toEqual(new Map([['a', 'over']]))
  })

  test('a zero-length feature covers the base it is painted from', () => {
    expect(rowValuesAt([feature('a', 50, 50, 'ins')], 50)).toEqual(
      new Map([['a', 'ins']]),
    )
  })
})

test('the menu row names the attribute the sort reads', () => {
  expect(columnSortLabel('state')).toBe('Sort rows by state here')
  expect(columnSortLabel('')).toBe('Sort rows by presence here')
  expect(columnSortLabel("jexl:get(feature,'x')")).toBe(
    'Sort rows by expression here',
  )
})
