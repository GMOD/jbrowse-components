import {
  MAX_SAMPLES_PER_PIXEL,
  parseSamplesPerPixel,
} from './parseSamplesPerPixel.ts'

test('parses a valid positive number', () => {
  expect(parseSamplesPerPixel('4')).toBe(4)
})

test('falls back to 1 for empty, non-numeric, or non-positive input', () => {
  expect(parseSamplesPerPixel('')).toBe(1)
  expect(parseSamplesPerPixel('abc')).toBe(1)
  expect(parseSamplesPerPixel('0')).toBe(1)
  expect(parseSamplesPerPixel('-5')).toBe(1)
})

test('clamps the upper end to bound the matrix allocation', () => {
  expect(parseSamplesPerPixel('100000')).toBe(MAX_SAMPLES_PER_PIXEL)
})
