import { isDataCurrent } from './isDataCurrent.ts'

test('matching keys are current', () => {
  expect(isDataCurrent('a|b', 'a|b')).toBe(true)
  expect(
    isDataCurrent({ view: 'a', settings: [1] }, { view: 'a', settings: [1] }),
  ).toBe(true)
})

test('differing keys are stale (post-zoom/reorder)', () => {
  expect(isDataCurrent('a|b', 'a|c')).toBe(false)
  expect(isDataCurrent({ settings: [1, 2] }, { settings: [2, 1] })).toBe(false)
})

test('an undefined-valued field is a distinct state', () => {
  expect(isDataCurrent({ filter: undefined }, {})).toBe(false)
})

test('nothing fetched yet is never current', () => {
  expect(isDataCurrent(undefined, 'a|b')).toBe(false)
})

test('current key undefined (views not ready) is not current', () => {
  expect(isDataCurrent('a|b', undefined)).toBe(false)
  expect(isDataCurrent(undefined, undefined)).toBe(false)
})
