import { scaleBandHeights } from './bandHeight.ts'

describe('scaleBandHeights', () => {
  test('splits by room above the floor, in whole pixels', () => {
    expect(scaleBandHeights([120, 420], -250, 20)).toEqual([70, 220])
    expect(scaleBandHeights([100, 100, 100], 10, 20)).toEqual([104, 103, 103])
  })

  test('moves the stack by exactly the rounded distance', () => {
    const heights = [37, 123, 250, 91]
    for (const distance of [-300, -17, -1, 1, 3, 250]) {
      const next = scaleBandHeights(heights, distance, 20)
      expect(next.reduce((a, b) => a + b, 0)).toBe(501 + distance)
    }
  })

  test('stops at the floor, and leaves a track already under it', () => {
    expect(scaleBandHeights([60, 420], -1000, 20)).toEqual([20, 20])
    expect(scaleBandHeights([10, 120], -50, 20)).toEqual([10, 70])
  })

  test('shares growth evenly when nothing has room', () => {
    expect(scaleBandHeights([20, 20], 30, 20)).toEqual([35, 35])
  })
})
