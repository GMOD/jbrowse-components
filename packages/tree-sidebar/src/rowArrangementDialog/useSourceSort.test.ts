import { nextSortState, sortRows } from './useSourceSort.ts'

import type { SortState } from './useSourceSort.ts'

const initial: SortState = { direction: 'asc', field: null }

describe('nextSortState', () => {
  test('first click on a column sorts ascending', () => {
    const next = nextSortState(initial, 'name')
    expect(next).toEqual({ direction: 'asc', field: 'name' })
  })

  test('clicks on the same column flip between ascending and descending', () => {
    let state = nextSortState(initial, 'name')
    state = nextSortState(state, 'name')
    expect(state).toEqual({ direction: 'desc', field: 'name' })
    state = nextSortState(state, 'name')
    expect(state).toEqual({ direction: 'asc', field: 'name' })
  })

  // The direction does not carry over from the prior column: a click on a
  // different column always starts ascending.
  test('clicking a new column resets direction to ascending', () => {
    const prior: SortState = { direction: 'desc', field: 'name' }
    const next = nextSortState(prior, 'color')
    expect(next).toEqual({ direction: 'asc', field: 'color' })
  })
})

describe('sortRows', () => {
  const rows = [
    { name: 'c', group: 'beta' },
    { name: 'a', group: 'alpha' },
    { name: 'b', group: 'beta' },
  ]

  test('ascending sort by name', () => {
    expect(sortRows(rows, 'name', 'asc').map(r => r.name)).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  test('descending sort by name', () => {
    expect(sortRows(rows, 'name', 'desc').map(r => r.name)).toEqual([
      'c',
      'b',
      'a',
    ])
  })

  test('sorting by a missing field stringifies to empty', () => {
    const result = sortRows(rows, 'missing', 'asc')
    // All keys equal "" — sort is stable, order preserved
    expect(result.map(r => r.name)).toEqual(['c', 'a', 'b'])
  })

  test('digit runs compare as numbers, so sample2 precedes sample10', () => {
    const samples = [{ name: 'sample10' }, { name: 'sample2' }]
    expect(sortRows(samples, 'name', 'asc').map(r => r.name)).toEqual([
      'sample2',
      'sample10',
    ])
  })

  test('does not mutate the input array', () => {
    const before = rows.map(r => r.name)
    sortRows(rows, 'name', 'asc')
    expect(rows.map(r => r.name)).toEqual(before)
  })
})

describe('cell order', () => {
  test('unset cells sort last either way, not under "undefined"', () => {
    const rows = [
      { name: 'a', group: 'zeta' },
      { name: 'b' },
      { name: 'c', group: 'alpha' },
    ]
    expect(sortRows(rows, 'group', 'asc').map(r => r.name)).toEqual([
      'c',
      'a',
      'b',
    ])
    expect(sortRows(rows, 'group', 'desc').map(r => r.name)).toEqual([
      'a',
      'c',
      'b',
    ])
  })

  test('numeric columns sort by value, not lexically', () => {
    const rows = [{ score: 10 }, { score: 2 }, { score: 100 }]
    expect(sortRows(rows, 'score', 'asc').map(r => r.score)).toEqual([
      2, 10, 100,
    ])
  })
})
