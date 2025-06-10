import { getClip } from './getClip'
import { test, expect } from 'vitest'

test('test clip', () => {
  expect(getClip('5S5M', 1)).toBe(5)
  expect(getClip('5S5M', -1)).toBe(0)
  expect(getClip('5M5S', 1)).toBe(0)
  expect(getClip('5M5S', -1)).toBe(5)
})
