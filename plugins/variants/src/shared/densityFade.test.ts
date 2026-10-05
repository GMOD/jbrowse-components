import {
  DENSE_OPACITY,
  fadeCellColors,
  recordDensityAlpha,
} from './densityFade.ts'

// n records stacked on the same pixels: every pixel holds all of them
const stacked = (n: number) =>
  Uint32Array.from({ length: 2 * n }, (_, i) => (i % 2 === 0 ? 1000 : 1001))

// opacity of k overlapping cells each drawn at alpha a
const composite = (a: number, k: number) => 1 - (1 - a) ** k

test('records that never share a pixel keep their colours', () => {
  expect(recordDensityAlpha(Uint32Array.from([0, 10, 100, 110]), 1)).toBe(
    undefined,
  )
})

test('a pixel whose records are all alt reaches the dense opacity, a share of them less', () => {
  const alpha = recordDensityAlpha(stacked(20), 10)!
  expect(composite(alpha[0]!, 20)).toBeCloseTo(DENSE_OPACITY)
  const half = composite(alpha[0]!, 10)
  expect(half).toBeLessThan(DENSE_OPACITY)
  expect(half).toBeGreaterThan(composite(alpha[0]!, 2))
})

test('a record shares pixels with neighbours its 2 px floor reaches', () => {
  const alpha = recordDensityAlpha(Uint32Array.from([0, 1, 1, 2, 500, 501]), 1)!
  expect(alpha[0]).toBeLessThan(1)
  expect(alpha[2]).toBe(1)
})

test('a faded cell keeps its colour and scales its alpha', () => {
  const colors = Uint32Array.from([0xff123456, 0x80abcdef])
  const out = fadeCellColors(colors, [0, 1], 2, Float32Array.from([0.5, 1]))
  expect(out[0]).toBe(0x80123456)
  expect(out[1]).toBe(0x80abcdef)
  expect(colors[0]).toBe(0xff123456)
})
