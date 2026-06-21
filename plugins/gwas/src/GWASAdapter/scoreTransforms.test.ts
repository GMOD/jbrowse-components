import { getScoreTransform } from './scoreTransforms.ts'

test('none is identity (no transform returned)', () => {
  expect(getScoreTransform('none')).toBeUndefined()
  expect(getScoreTransform('')).toBeUndefined()
})

test('negLog10 maps a raw p-value to -log10(p)', () => {
  const t = getScoreTransform('negLog10')!
  expect(t(0.01)).toBeCloseTo(2)
  expect(t(5e-8)).toBeCloseTo(7.301)
})

test('negLog10FromLn maps a natural-log p-value to -log10(p)', () => {
  const t = getScoreTransform('negLog10FromLn')!
  // ln(0.01) -> 2, matching negLog10(0.01)
  expect(t(Math.log(0.01))).toBeCloseTo(2)
  expect(t(Math.log(5e-8))).toBeCloseTo(7.301)
})
