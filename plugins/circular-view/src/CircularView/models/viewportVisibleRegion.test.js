import {
  viewportVisibleSection,
  cartesianToPolar,
  thetaRangesOverlap,
} from './viewportVisibleRegion'

describe('viewportVisibleSection', () => {
  // test('circle contained in viewport', () => {
  //   const result = viewportVisibleSection([0, 1, 0, 1], [0.5, 0.5], 0.3)
  //   expect(result).toEqual({ rho: [0, 0.3], theta: [0, 2 * Math.PI] })
  // })

  // test('viewport completely inside circle', () => {
  //   const result = viewportVisibleSection([0, 1, 0, 1], [0.5, 0.5], 20)
  //   expect(result.theta).toEqual([0, 2 * Math.PI])
  //   expect(result.rho[0]).toEqual(0)
  //   expect(result.rho[1]).toBeCloseTo(0.7071)
  // })

  // test('viewport on left half of circle', () => {
  //   const result = viewportVisibleSection([200, 500, 0, 1000], [500, 500], 20)
  //   expect(result).toEqual({
  //     rho: [0, 20],
  //     theta: [Math.PI / 2, 1.5 * Math.PI],
  //   })
  // })
  // test('viewport on right half of circle', () => {
  //   const result = viewportVisibleSection([200, 500, 0, 1000], [200, 500], 20)
  //   expect(result).toEqual({
  //     rho: [0, 20],
  //     theta: [1.5 * Math.PI, 2.5 * Math.PI],
  //   })
  // })

  // test('viewport corner in circle', () => {
  //   const { theta, rho } = viewportVisibleSection(
  //     [200, 500, 0, 700],
  //     [199, 701],
  //     100,
  //   )
  //   expect(rho).toEqual([1.4142135623730951, 100])
  //   expect(theta[0]).toBeCloseTo(1.5 * Math.PI, 1)
  //   expect(theta[1]).toBeCloseTo(2 * Math.PI, 1)
  // })

  // test('viewport on center right', () => {
  //   const { theta, rho } = viewportVisibleSection(
  //     [1102, 2153, 880, 1280],
  //     [1068.8119697255406, 1068.8119697255406],
  //     1048.8119697255406,
  //   )
  //   expect(theta[1]).toBeGreaterThan(2 * Math.PI)
  //   expect(theta[1]).toBeLessThan(2.5 * Math.PI)
  //   expect(theta[0]).toBeGreaterThan(1.5 * Math.PI)
  //   expect(theta[0]).toBeLessThan(2 * Math.PI)
  // })

  // test('viewport on center right 2', () => {
  //   const { theta, rho } = viewportVisibleSection(
  //     [1816, 2937, 1074, 1474],
  //     [1468.6015446723616, 1468.6015446723616],
  //     1448.6015446723616,
  //   )
  //   expect(theta[1]).toBeGreaterThan(2 * Math.PI)
  //   expect(theta[1]).toBeLessThan(2.5 * Math.PI)
  //   expect(theta[0]).toBeGreaterThan(1.5 * Math.PI)
  //   expect(theta[0]).toBeLessThan(2 * Math.PI)
  // })

  // test('viewport on lower center', () => {
  //   const { theta, rho } = viewportVisibleSection(
  //     [259, 1350, 1176, 1576],
  //     [787.7952717090081, 787.7952717090081],
  //     767.7952717090081,
  //   )
  //   expect(theta[1]).toBeGreaterThan(Math.PI / 2)
  //   expect(theta[1]).toBeLessThan(Math.PI)
  //   expect(theta[0]).toBeGreaterThan(0)
  //   expect(theta[0]).toBeLessThan(Math.PI / 2)
  // })

  // test('viewport on upper center', () => {
  //   const { theta, rho } = viewportVisibleSection(
  //     [286, 1377, 0, 400],
  //     [787.7952717090081, 787.7952717090081],
  //     767.7952717090081,
  //   )
  //   expect(theta[1]).toBeGreaterThan(1.5 * Math.PI)
  //   expect(theta[1]).toBeLessThan(2 * Math.PI)
  //   expect(theta[0]).toBeGreaterThan(Math.PI)
  //   expect(theta[0]).toBeLessThan(1.5 * Math.PI)
  // })

  test('viewport on upper center 2', () => {
    // [180.48708681644143, 359.3411680673888] [4.6042679453532855, 541.6042679453533]
    // see '~/Desktop/Screen Shot 2019-06-28 at 3.01.22 PM.png'
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
  ;[
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
  ].forEach(testCase => {
    const [input, output] = testCase
    test(`${input} -> ${output}`, () => {
      const result = cartesianToPolar(...input)
      expect(result[0]).toBeCloseTo(output[0])
      expect((result[1] * 180) / Math.PI).toBeCloseTo(output[1])
    })
  })
})

describe('theta overlap testing', () => {
  ;[
    [[0, 2 * Math.PI, 0, 2 * Math.PI], true],
    [[6.1, Math.PI / 2, 0, Math.PI / 2], true],
    [[6.1, Math.PI / 2, 0, 0.1], true],
    [[6.1, 0.1, 6.12, 0.05], true],
    [[-12, 0.1, -12.05, 0.05], false],
    [[-12, 0.1, -12.05, 0.06], true],
  ].forEach(testCase => {
    const [input, output] = testCase
    test(`${input} -> ${output}`, () => {
      const result = thetaRangesOverlap(...input)
      expect(result).toBe(output)
    })
  })
})
