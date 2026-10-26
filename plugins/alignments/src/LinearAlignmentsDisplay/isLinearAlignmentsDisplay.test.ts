import { isLinearAlignmentsDisplay } from './isLinearAlignmentsDisplay.ts'

test('only the reads display passes', () => {
  expect(isLinearAlignmentsDisplay({ type: 'LinearAlignmentsDisplay' })).toBe(
    true,
  )
  expect(isLinearAlignmentsDisplay({ type: 'LinearBasicDisplay' })).toBe(false)
  expect(isLinearAlignmentsDisplay(undefined)).toBe(false)
})
