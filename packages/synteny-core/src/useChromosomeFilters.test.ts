import { act, renderHook } from '@testing-library/react'

import { useChromosomeFilters } from './useChromosomeFilters.ts'

function setup(rows: string[], values: string[]) {
  const { result } = renderHook(() => useChromosomeFilters())
  act(() => {
    for (const [idx, value] of values.entries()) {
      result.current.set(idx, value)
    }
  })
  const remap = (to: string[]) => {
    act(() => {
      result.current.remap(rows, to)
    })
    return result.current.values
  }
  return { result, remap }
}

test('a row that stays put keeps what was typed for it', () => {
  const { remap } = setup(['a', 'b', 'c'], ['x', 'y', 'z'])
  expect(remap(['a', 'd', 'c'])).toEqual(['x', '', 'z'])
})

// Every row below a removal shifts up, so matching on position alone silently
// dropped everything the user had typed there.
test('a removed row takes only its own text', () => {
  const { remap } = setup(['a', 'b', 'c'], ['x', 'y', 'z'])
  expect(remap(['a', 'c'])).toEqual(['x', 'z'])
})

test('reversing the rows carries each row text with it', () => {
  const { remap } = setup(['a', 'b', 'c'], ['x', 'y', 'z'])
  expect(remap(['c', 'b', 'a'])).toEqual(['z', 'y', 'x'])
})

test('an added row starts empty', () => {
  const { remap } = setup(['a', 'b'], ['x', 'y'])
  expect(remap(['a', 'b', 'c'])).toEqual(['x', 'y', ''])
})

// The positional pass runs first for this: row 2 did not move, so its text is
// row 2's, and retyping row 1 into the same assembly must not pull it over.
test('retyping a row into a name another row holds does not take that text', () => {
  const { remap } = setup(['a', 'b'], ['x', 'y'])
  expect(remap(['b', 'b'])).toEqual(['', 'y'])
})

test('hiding the boxes clears them', () => {
  const { result } = setup(['a', 'b'], ['x', 'y'])
  act(() => {
    result.current.setShown(false)
  })
  expect(result.current.values).toEqual([])
  expect(result.current.get(0)).toBe('')
})
