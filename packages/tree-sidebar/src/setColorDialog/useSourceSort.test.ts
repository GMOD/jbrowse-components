import { nextSortState, sortRows } from './useSourceSort.ts'

import type { SortState } from './useSourceSort.ts'

const initial: SortState = { direction: 'asc', field: null }

describe('nextSortState', () => {
  test('first click on a column sorts ascending', () => {
    const next = nextSortState(initial, [{ field: 'name', sort: 'asc' }])
    expect(next).toEqual({ direction: 'asc', field: 'name' })
  })

  test('second click on the same column flips to descending', () => {
    const first = nextSortState(initial, [{ field: 'name', sort: 'asc' }])
    const second = nextSortState(first, [{ field: 'name', sort: 'desc' }])
    expect(second).toEqual({ direction: 'desc', field: 'name' })
  })

  // Regression: previously the direction would carry over from the prior
  // column, so clicking a new column after a descending sort produced a
  // descending sort on the new column — confusing UX. New click of a
  // different column should always start ascending.
  test('clicking a new column resets direction to ascending', () => {
    const prior: SortState = { direction: 'desc', field: 'name' }
    const next = nextSortState(prior, [{ field: 'color', sort: 'asc' }])
    expect(next).toEqual({ direction: 'asc', field: 'color' })
  })

  test('MUI tri-state clear keeps the field and flips direction', () => {
    const prior: SortState = { direction: 'asc', field: 'name' }
    const next = nextSortState(prior, [])
    expect(next).toEqual({ direction: 'desc', field: 'name' })
  })

  test('a long sequence stays on the same column when MUI clears', () => {
    let state = initial
    state = nextSortState(state, [{ field: 'name', sort: 'asc' }])
    state = nextSortState(state, [{ field: 'name', sort: 'desc' }])
    state = nextSortState(state, []) // tri-state clear → flip + keep field
    expect(state.field).toBe('name')
    expect(state.direction).toBe('asc')
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

  test('does not mutate the input array', () => {
    const before = rows.map(r => r.name)
    sortRows(rows, 'name', 'asc')
    expect(rows.map(r => r.name)).toEqual(before)
  })
})
