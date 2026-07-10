import { isDataCurrent } from './fetchKeyFreshness.ts'

test('matching keys are current', () => {
  expect(isDataCurrent('a|b', 'a|b')).toBe(true)
})

test('differing keys are stale (post-zoom/reorder)', () => {
  expect(isDataCurrent('a|b', 'a|c')).toBe(false)
})

test('nothing fetched yet is never current', () => {
  expect(isDataCurrent(undefined, 'a|b')).toBe(false)
})

test('current key undefined (views not ready) is not current', () => {
  expect(isDataCurrent('a|b', undefined)).toBe(false)
  expect(isDataCurrent(undefined, undefined)).toBe(false)
})
