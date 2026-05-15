import { normalizeScore } from './normalizeScore.ts'

describe('normalizeScore linear (scaleType 0)', () => {
  test('domain min maps to 0', () => {
    expect(normalizeScore(0, [0, 10], 0)).toBe(0)
  })

  test('domain max maps to 1', () => {
    expect(normalizeScore(10, [0, 10], 0)).toBe(1)
  })

  test('midpoint maps to 0.5', () => {
    expect(normalizeScore(5, [0, 10], 0)).toBe(0.5)
  })

  test('clamps below domain', () => {
    expect(normalizeScore(-100, [0, 10], 0)).toBe(0)
  })

  test('clamps above domain', () => {
    expect(normalizeScore(100, [0, 10], 0)).toBe(1)
  })
})

describe('normalizeScore log (scaleType 1)', () => {
  test('clamps scores below 1 to 0', () => {
    expect(normalizeScore(0.5, [1, 100], 1)).toBe(0)
  })

  test('domain max maps to 1', () => {
    expect(normalizeScore(100, [1, 100], 1)).toBe(1)
  })

  test('geometric midpoint maps to 0.5', () => {
    expect(normalizeScore(10, [1, 100], 1)).toBeCloseTo(0.5)
  })
})
