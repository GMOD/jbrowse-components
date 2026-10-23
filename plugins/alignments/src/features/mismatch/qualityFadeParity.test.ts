import { QUAL_UNAVAILABLE } from '../../shaders/slang/mismatch.consts.generated.ts'
import { qualityFade } from '../../shaders/slang/mismatch.js.generated.ts'
import {
  DEFAULT_QUALITY_FADE,
  OPAQUE_MISMATCHES,
  qualityOpacityOf,
} from './qualityOpacity.ts'

import type { QualityOpacity } from './qualityOpacity.ts'

// The retirement gate for mismatch.slang's `//! js-export` (adr-051).
//
// `retiredQualAlpha` is the hand-written twin the mismatch painter carried, under the
// comment "Mirrors the GPU mismatch.slang path". It stays here as a fixture so
// the generated function is proved against what actually shipped rather than
// against a fresh reading of the shader — which is the same reading that would
// have missed a drift.
//
// The two backends disagreeing would show as SVG exports whose mismatch
// columns are a different weight from the screen. The sweep favours where they
// could: the sentinel (the one value the ramp must NOT apply to), the boundary
// at the opaque threshold, and quals past it, where the clamp is the only
// thing keeping alpha at 1.

function retiredQualAlpha(qual: number, fadeLowQualityMismatches: boolean) {
  return fadeLowQualityMismatches && qual > 0 ? Math.min(1, qual / 50) : 1
}

function fade(qual: number, { zero, slope, min, max }: QualityOpacity) {
  return qualityFade(qual, zero, slope, min, max)
}

function scaleOf(
  domain: number[],
  range: number[],
  clamp = true,
): QualityOpacity {
  return qualityOpacityOf({
    field: 'baseQuality',
    scale: { domain: domain.map(String), range: range.map(String), clamp },
  })
}

// 50 is the threshold; 93 the highest Phred a Sanger-encoded BAM can carry; 255
// the sentinel.
const QUALS = [0, 1, 2, 10, 20, 25, 30, 37, 49, 50, 51, 60, 93, 255]

test('the generated qualityFade reproduces the hand-written twin it replaced', () => {
  // Every quality but 0, which is the one value the sentinel move deliberately
  // changed — see the test below. Excluding it keeps this a drift gate on the
  // other thirteen rather than a fixture rewritten to agree with the code.
  for (const qual of QUALS.filter(q => q !== 0)) {
    expect(fade(qual, OPAQUE_MISMATCHES)).toBe(retiredQualAlpha(qual, false))
    expect(fade(qual, DEFAULT_QUALITY_FADE)).toBeCloseTo(
      retiredQualAlpha(qual, true),
      9,
    )
  }
})

test('no field leaves every quality opaque', () => {
  for (const qual of QUALS) {
    expect(fade(qual, OPAQUE_MISMATCHES)).toBe(1)
  }
  expect(
    qualityOpacityOf({
      field: undefined,
      scale: { domain: ['0', '30'], range: ['0', '1'], clamp: true },
    }),
  ).toBe(OPAQUE_MISMATCHES)
})

test('the sentinel means "no quality" and does not ramp', () => {
  // A base whose read carries no QUAL, and every base of the softclip-bases
  // pass, packs QUAL_UNAVAILABLE. Ramping it would fade exactly the bases there
  // is no evidence against.
  expect(fade(QUAL_UNAVAILABLE, DEFAULT_QUALITY_FADE)).toBe(1)
  expect(fade(QUAL_UNAVAILABLE, scaleOf([0, 300], [0, 1]))).toBe(1)
})

test('Phred 0 is the worst score, not the missing one', () => {
  // The regression this replaced: 0 took the no-quality branch and drew opaque
  // while Phred 1 drew at 0.02, so the ramp inverted across its own first step
  // and the least trustworthy call in the file was the most visible.
  expect(fade(0, DEFAULT_QUALITY_FADE)).toBe(0)
  expect(fade(0, DEFAULT_QUALITY_FADE)).toBeLessThan(
    fade(1, DEFAULT_QUALITY_FADE),
  )
})

test('quality ramps linearly to the opaque threshold', () => {
  expect(fade(10, DEFAULT_QUALITY_FADE)).toBeCloseTo(0.2, 9)
  expect(fade(25, DEFAULT_QUALITY_FADE)).toBeCloseTo(0.5, 9)
  expect(fade(50, DEFAULT_QUALITY_FADE)).toBe(1)
})

test('a quality past the threshold clamps rather than over-saturating', () => {
  expect(fade(93, DEFAULT_QUALITY_FADE)).toBe(1)
})

test('a written domain moves the opaque threshold', () => {
  const to30 = scaleOf([0, 30], [0, 1])
  expect(fade(15, to30)).toBeCloseTo(0.5, 9)
  expect(fade(30, to30)).toBeCloseTo(1, 9)
  expect(fade(40, to30)).toBe(1)
})

test('a written range holds a floor under clamp, and runs past it without', () => {
  const floored = scaleOf([10, 30], [0.2, 1])
  expect(fade(20, floored)).toBeCloseTo(0.6, 9)
  expect(fade(0, floored)).toBeCloseTo(0.2, 9)
  const unclamped = scaleOf([10, 30], [0.2, 1], false)
  expect(fade(20, unclamped)).toBeCloseTo(0.6, 9)
  expect(fade(5, unclamped)).toBeCloseTo(0, 9)
  expect(fade(40, unclamped)).toBe(1)
})

test('a descending range fades the best calls', () => {
  const inverted = scaleOf([0, 50], [1, 0])
  expect(fade(0, inverted)).toBeCloseTo(1, 9)
  expect(fade(40, inverted)).toBeCloseTo(0.2, 9)
})

test('a flat range or an empty domain draws one opacity', () => {
  expect(fade(5, scaleOf([0, 50], [0.4, 0.4]))).toBeCloseTo(0.4, 6)
  expect(fade(5, scaleOf([20, 20], [0, 1]))).toBeCloseTo(0.5, 6)
})

test('a domain or range that is not two numbers takes the default', () => {
  const bad = qualityOpacityOf({
    field: 'baseQuality',
    scale: { domain: ['x'], range: ['0', '1', '2'], clamp: true },
  })
  expect(bad).toEqual(DEFAULT_QUALITY_FADE)
})
