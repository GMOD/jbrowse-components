import {
  cartesianToPolar,
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
