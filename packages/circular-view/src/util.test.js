import { viewportVisibleSlice, cartesianToPolar } from './util'

describe('viewportVisibleSlice', () => {
  test('circle contained in viewport', () => {
    const result = viewportVisibleSlice([0, 1, 0, 1], [0.5, 0.5], 0.3)
    expect(result).toEqual({ rho: [0, 0.3], theta: [0, 2 * Math.PI] })
  })

  test('viewport completely inside circle', () => {
    const result = viewportVisibleSlice([0, 1, 0, 1], [0.5, 0.5], 20)
    expect(result.theta).toEqual([0, 2 * Math.PI])
    expect(result.rho[0]).toEqual(0)
    expect(result.rho[1]).toBeCloseTo(0.7071)
  })

  test('viewport on left half of circle', () => {
    const result = viewportVisibleSlice([200, 500, 0, 1000], [500, 500], 20)
    expect(result).toEqual({
      rho: [0, 20],
      theta: [Math.PI / 2, 1.5 * Math.PI],
    })
  })
  test('viewport on right half of circle', () => {
    const result = viewportVisibleSlice([200, 500, 0, 1000], [200, 500], 20)
    expect(result).toEqual({
      rho: [0, 20],
      theta: [1.5 * Math.PI, 2.5 * Math.PI],
    })
  })

  test('viewport corner in circle', () => {
    const { theta, rho } = viewportVisibleSlice(
      [200, 500, 0, 700],
      [199, 701],
      100,
    )
    expect(rho).toEqual([1.4142135623730951, 100])
    expect(theta[0]).toBeCloseTo(1.5 * Math.PI, 1)
    expect(theta[1]).toBeCloseTo(2 * Math.PI, 1)
  })
})

describe('cartesian to polar', () => {
  ;[
    [[-1, -1], [1.414, 180 + 45]],
    [[-1, 1], [1.414, 90 + 45]],
    [[1, 1], [1.414, 45]],
    [[1, -1], [1.414, 360 - 45]],
    [[0, 1], [1, 90]],
    [[0, -1], [1, 270]],
    [[-1, 0], [1, 180]],
    [[1, 0], [1, 0]],
  ].forEach(testCase => {
    const [input, output] = testCase
    test(`${input} -> ${output}`, () => {
      const result = cartesianToPolar(...input)
      expect(result[0]).toBeCloseTo(output[0])
      expect((result[1] * 180) / Math.PI).toBeCloseTo(output[1])
    })
  })
})
