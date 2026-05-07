import {
  cartesianToPolar,
  thetaRangesOverlap,
  viewportVisibleSection,
} from './viewportVisibleRegion.ts'

describe('viewportVisibleSection', () => {
  test('viewport on upper center 2', () => {
    const { theta } = viewportVisibleSection(
      [0, 962, 157, 557],
      [561.6042679453533, 561.6042679453533],
      541.6042679453533,
    )
    expect(theta[1]).toBeGreaterThan(1.75 * Math.PI)
    expect(theta[1]).toBeLessThan(2 * Math.PI)
    expect(theta[0]).toBeGreaterThan(Math.PI)
    expect(theta[0]).toBeLessThan(1.1 * Math.PI)
  })
})

describe('cartesian to polar', () => {
  for (const [input, output] of [
    [
      [-1, -1],
      [1.414, 180 + 45],
    ],
    [
      [-1, 1],
      [1.414, 90 + 45],
    ],
    [
      [1, 1],
      [1.414, 45],
    ],
    [
      [1, -1],
      [1.414, 360 - 45],
    ],
    [
      [0, 1],
      [1, 90],
    ],
    [
      [0, -1],
      [1, 270],
    ],
    [
      [-1, 0],
      [1, 180],
    ],
    [
      [1, 0],
      [1, 0],
    ],
  ] as [[number, number], [number, number]][]) {
    test(`${input} -> ${output}`, () => {
      const result = cartesianToPolar(input[0], input[1])
      expect(result[0]).toBeCloseTo(output[0])
      expect((result[1] * 180) / Math.PI).toBeCloseTo(output[1])
    })
  }
})

describe('theta overlap testing', () => {
  for (const [input, output] of [
    [[0, 2 * Math.PI, 0, 2 * Math.PI], true],
    [[6.1, Math.PI / 2, 0, Math.PI / 2], true],
    [[6.1, Math.PI / 2, 0, 0.1], true],
    [[6.1, 0.1, 6.12, 0.05], true],
    [[-12, 0.1, -12.05, 0.05], false],
    [[-12, 0.1, -12.05, 0.06], true],
  ] as [[number, number, number, number], boolean][]) {
    test(`${input} -> ${output}`, () => {
      const result = thetaRangesOverlap(input[0], input[1], input[2], input[3])
      expect(result).toBe(output)
    })
  }
})
