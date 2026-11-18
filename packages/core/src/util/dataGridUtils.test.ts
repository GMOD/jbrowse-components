import { measureGridWidth } from './dataGridUtils.ts'

test('an empty column measures at its minimum width', () => {
  expect(measureGridWidth([])).toBe(80)
  expect(measureGridWidth([], { minWidth: 120 })).toBe(120)
})
