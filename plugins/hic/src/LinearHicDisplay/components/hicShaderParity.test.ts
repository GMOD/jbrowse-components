import { mapHicCount } from './shaders/hic.js.generated.ts'

// The retirement gate for hic's `//! js-export` (adr-051), and the first one
// lifted from a shader with entry points rather than from a module: the export
// is the fragment stage's own `t` computation, factored into a function so the
// draw path still calls it.
//
// `retiredMapHicCount` below is the hand-written twin colorRamp.ts carried
// verbatim, under the comment "Mirrors the logic in hic.slang's fragment
// shader". It stays here as a fixture so the generated function is proved
// against it rather than against a re-reading of the shader.
//
// The sweep favours where a count→color mapping actually breaks: the two
// denominator floors (an empty block gives colorMaxScore 0, a single-contact
// one gives 1, and log2 of either divides by zero), counts below 1 in log mode,
// and negative counts — a normalized .hic matrix produces all of them.

function retiredMapHicCount(
  count: number,
  colorMaxScore: number,
  useLogScale: boolean,
) {
  if (useLogScale) {
    const m = Math.max(colorMaxScore, 2)
    return Math.max(
      0,
      Math.min(1, Math.log2(Math.max(count, 1)) / Math.log2(m)),
    )
  }
  return Math.max(0, Math.min(1, count / Math.max(colorMaxScore, 0.001)))
}

const COUNTS = [-5, -0.001, 0, 0.5, 1, 1.2, 2, 16, 99.5, 100, 256, 1e6]
const MAX_SCORES = [0, 0.5, 1, 1.5, 2, 100, 256, 1e6]

test('the generated mapHicCount reproduces the hand-written twin it replaced', () => {
  for (const count of COUNTS) {
    for (const max of MAX_SCORES) {
      for (const log of [false, true]) {
        // The shader spells the linear floor `0.001`, which slangc emits as its
        // f32 value (0.00100000004749745) — a relative difference of 5e-8 in
        // the divisor, five orders of magnitude below the 1/255 the result is
        // eventually quantized to. Nothing here needs bit-exactness, and the
        // generated form is the more faithful one: it is the number the GPU
        // divides by.
        expect(mapHicCount(count, max, log)).toBeCloseTo(
          retiredMapHicCount(count, max, log),
          9,
        )
      }
    }
  }
})

// Properties the twin was written for, asserted directly rather than only
// through it — a divergence here surfaces as an SVG export whose colors don't
// match what was on screen, which nothing else in the suite would catch.

test('linear maps count/colorMaxScore into [0,1]', () => {
  expect(mapHicCount(0, 100, false)).toBe(0)
  expect(mapHicCount(50, 100, false)).toBe(0.5)
  expect(mapHicCount(100, 100, false)).toBe(1)
})

test('log maps log2(count)/log2(colorMaxScore)', () => {
  // counts below 1 clamp up to 1 first, so the ramp starts at t=0
  expect(mapHicCount(0, 256, true)).toBe(0)
  expect(mapHicCount(1, 256, true)).toBe(0)
  expect(mapHicCount(16, 256, true)).toBe(0.5)
  expect(mapHicCount(256, 256, true)).toBe(1)
})

test('clamps a count above the saturation point instead of overflowing', () => {
  expect(mapHicCount(1e6, 100, false)).toBe(1)
  expect(mapHicCount(1e6, 256, true)).toBe(1)
})

test('a negative count floors at 0 rather than sampling off the ramp', () => {
  expect(mapHicCount(-5, 100, false)).toBe(0)
  expect(mapHicCount(-5, 256, true)).toBe(0)
})

test.each([0, 1, 1.5])(
  'log floors the denominator at 2, so colorMaxScore=%p cannot divide by log2(1)=0',
  max => {
    const t = mapHicCount(1.2, max, true)
    expect(Number.isFinite(t)).toBe(true)
    expect(t).toBeGreaterThanOrEqual(0)
    expect(t).toBeLessThanOrEqual(1)
  },
)

test('linear floors the denominator so colorMaxScore=0 does not divide by zero', () => {
  // 0/0 would be NaN; the 0.001 floor makes any positive count saturate
  expect(mapHicCount(0, 0, false)).toBe(0)
  expect(mapHicCount(5, 0, false)).toBe(1)
})
