import createJexlInstance from '@jbrowse/core/util/jexl'

import { getScoreTransform } from './scoreTransforms.ts'

// getScoreTransform warns on anything it doesn't recognize; capture it so the
// misconfiguration cases stay silent here and can be asserted on.
let warn: jest.SpyInstance
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  warn.mockRestore()
})

test('none is identity (no transform returned), silently', () => {
  expect(getScoreTransform('none')).toBeUndefined()
  expect(getScoreTransform('')).toBeUndefined()
  expect(warn).not.toHaveBeenCalled()
})

test('a jexl expression transforms the score column value', () => {
  const jexl = createJexlInstance()
  const t = getScoreTransform('jexl:score * 2 + 1', jexl)!
  expect(t(3)).toBe(7)
  expect(warn).not.toHaveBeenCalled()
})

test('a jexl expression without a jexl instance falls through, but warns', () => {
  expect(getScoreTransform('jexl:score * 2')).toBeUndefined()
  expect(warn).toHaveBeenCalledTimes(1)
})

test('an unrecognized mode falls through, but warns instead of silently plotting raw p-values', () => {
  expect(getScoreTransform('neglog10')).toBeUndefined()
  expect(warn).toHaveBeenCalledTimes(1)
})

// `transforms[mode]` on an object literal would resolve these off
// Object.prototype and hand back a prototype function as the transform.
test('does not resolve Object.prototype members as transforms', () => {
  for (const mode of ['toString', 'valueOf', 'constructor', 'hasOwnProperty']) {
    expect(getScoreTransform(mode)).toBeUndefined()
  }
})

test('negLog10 maps a raw p-value to -log10(p)', () => {
  const t = getScoreTransform('negLog10')!
  expect(t(0.01)).toBeCloseTo(2)
  expect(t(5e-8)).toBeCloseTo(7.301)
})

test('negLog10 clamps underflowed p=0 to a large finite value', () => {
  const t = getScoreTransform('negLog10')!
  const v = t(0)
  expect(Number.isFinite(v)).toBe(true)
  expect(v).toBeGreaterThan(300)
})

test('negLog10FromLn maps a natural-log p-value to -log10(p)', () => {
  const t = getScoreTransform('negLog10FromLn')!
  // ln(0.01) -> 2, matching negLog10(0.01)
  expect(t(Math.log(0.01))).toBeCloseTo(2)
  expect(t(Math.log(5e-8))).toBeCloseTo(7.301)
})
