import { SCALE_TYPE_LINEAR } from '@jbrowse/wiggle-core'

import { makeDensityRgbStringFn } from './getDensityColor.ts'
import { densityGradientT } from './shaders/wiggleCommon.js.generated.ts'

// The retirement gate for wiggle.slang's `//! js-export` (adr-051).
//
// `retiredDensityT` is the arithmetic getDensityColor.ts open-coded, hoisting
// the reciprocal out of the per-feature loop. Its own comment recorded that the
// `max(maxDist, 0.0001)` floor can never fire and was carried purely so a reader
// comparing the two backends saw identical expressions — which is the drift
// risk stated outright, and what the generated twin removes.
//
// The sweep is over the pivot, because that is what varies: `origin` is the
// bicolorPivot setting, and normalizing it against the y domain puts zeroNorm
// anywhere in [0,1] — including the ends, where one side of the ramp has zero
// span and the other has all of it.

function retiredDensityT(norm: number, zeroNorm: number) {
  const maxDist = Math.max(zeroNorm, 1 - zeroNorm)
  return Math.abs(norm - zeroNorm) * (1 / Math.max(maxDist, 0.0001))
}

const NORMS = [0, 0.05, 0.25, 0.5, 0.75, 0.95, 1]
const PIVOTS = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]

test('the generated densityGradientT reproduces the arithmetic it replaced', () => {
  for (const norm of NORMS) {
    for (const zeroNorm of PIVOTS) {
      // 6 places, not bit equality: slangc emits the 0.0001 floor as its f32
      // value. It is never the max here, so this is exact in practice; the
      // tolerance is the standing rule for generated float32 literals.
      expect(densityGradientT(norm, zeroNorm)).toBeCloseTo(
        retiredDensityT(norm, zeroNorm),
        6,
      )
    }
  }
})

test('the pivot itself sits at the white end of the ramp', () => {
  for (const zeroNorm of PIVOTS) {
    expect(densityGradientT(zeroNorm, zeroNorm)).toBe(0)
  }
})

test('the far end of the domain saturates at the track color', () => {
  // maxDist is the pivot's distance to whichever end is further, so that end is
  // t=1 and the near end falls short of it — the gradient is not symmetric
  // around an off-center pivot, and both backends have to agree on which way.
  expect(densityGradientT(1, 0.25)).toBe(1)
  expect(densityGradientT(0, 0.25)).toBeCloseTo(1 / 3, 9)
  expect(densityGradientT(0, 0.75)).toBe(1)
  expect(densityGradientT(1, 0.75)).toBeCloseTo(1 / 3, 9)
})

test('a pivot at either end still spans the full ramp', () => {
  // maxDist >= 0.5 always, so nothing divides by ~0 and the 0.0001 floor the
  // retired twin carried is unreachable — asserted here so removing it later
  // is a decision rather than an accident.
  expect(densityGradientT(1, 0)).toBe(1)
  expect(densityGradientT(0, 1)).toBe(1)
  expect(densityGradientT(0.5, 0)).toBeCloseTo(0.5, 9)
})

test('the string LUT quantizes the shared ramp, not a second copy of it', () => {
  // The generated t is what indexes the 256-bucket color cache, so a divergence
  // would show as an SVG export a bucket off from the screen. Pin the end
  // points through the public factory.
  const f = makeDensityRgbStringFn(0, 100, SCALE_TYPE_LINEAR, 0, 0, 255)
  expect(f(0)).toBe('rgb(255,255,255)')
  expect(f(100)).toBe('rgb(0,0,255)')
})
