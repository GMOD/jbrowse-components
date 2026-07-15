import { sliderScale } from './sliderScale.ts'

test('linear is the identity with a caller-supplied step', () => {
  const { toSlider, fromSlider, sliderStep } = sliderScale('linear')
  expect(toSlider(42)).toBe(42)
  expect(fromSlider(42)).toBe(42)
  expect(sliderStep).toBeUndefined()
})

test('log maps orders of magnitude and round-trips real values', () => {
  const { toSlider, fromSlider, sliderStep } = sliderScale('log')
  expect(toSlider(1)).toBe(0)
  expect(fromSlider(0)).toBe(1)
  expect(sliderStep).toBe(1)
  for (const bp of [1, 100, 1000, 50_000, 1_000_000]) {
    expect(fromSlider(toSlider(bp))).toBe(bp)
  }
  // values below 1 clamp to the slider origin (log2 of <1 is negative)
  expect(toSlider(0)).toBe(0)
})

test('cubic gives fine control near 0 across [0,1]', () => {
  const { toSlider, fromSlider, sliderStep } = sliderScale('cubic')
  expect(toSlider(0)).toBe(0)
  expect(toSlider(1)).toBe(1)
  expect(sliderStep).toBe(0.01)
  expect(fromSlider(0.5)).toBeCloseTo(0.125)
  for (const alpha of [0, 0.1, 0.5, 0.9, 1]) {
    expect(fromSlider(toSlider(alpha))).toBeCloseTo(alpha)
  }
})
