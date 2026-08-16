import { QUAL_UNAVAILABLE } from '../../shaders/slang/mismatch.consts.generated.ts'
import { qualityFade } from '../../shaders/slang/mismatch.js.generated.ts'

// The retirement gate for mismatch.slang's `//! js-export` (adr-051).
//
// `retiredQualAlpha` is the hand-written twin drawMismatches carried, under the
// comment "Mirrors the GPU mismatch.slang path". It stays here as a fixture so
// the generated function is proved against what actually shipped rather than
// against a fresh reading of the shader — which is the same reading that would
// have missed a drift.
//
// The whole mismatchAlpha setting is these three branches, and the two backends
// disagreeing would show as SVG exports whose mismatch columns are a different
// weight from the screen. The sweep favours where they could: the sentinel (the
// one value the ramp must NOT apply to), the boundary at the opaque threshold,
// and quals past it, where `min` is the only thing keeping alpha at 1.

function retiredQualAlpha(qual: number, mismatchAlpha: boolean) {
  return mismatchAlpha && qual > 0 ? Math.min(1, qual / 50) : 1
}

// 50 is the threshold; 93 the highest Phred a Sanger-encoded BAM can carry; 255
// the sentinel.
const QUALS = [0, 1, 2, 10, 20, 25, 30, 37, 49, 50, 51, 60, 93, 255]

test('the generated qualityFade reproduces the hand-written twin it replaced', () => {
  // Every quality but 0, which is the one value the sentinel move deliberately
  // changed — see the test below. Excluding it keeps this a drift gate on the
  // other thirteen rather than a fixture rewritten to agree with the code.
  for (const qual of QUALS.filter(q => q !== 0)) {
    for (const on of [false, true]) {
      expect(qualityFade(qual, on)).toBeCloseTo(retiredQualAlpha(qual, on), 9)
    }
  }
})

test('the setting off leaves every quality opaque', () => {
  for (const qual of QUALS) {
    expect(qualityFade(qual, false)).toBe(1)
  }
})

test('the sentinel means "no quality" and does not ramp', () => {
  // A base whose read carries no QUAL, and every base of the softclip-bases
  // pass, packs QUAL_UNAVAILABLE. Ramping it would fade exactly the bases there
  // is no evidence against.
  expect(qualityFade(QUAL_UNAVAILABLE, true)).toBe(1)
})

test('Phred 0 is the worst score, not the missing one', () => {
  // The regression this replaced: 0 took the no-quality branch and drew opaque
  // while Phred 1 drew at 0.02, so the ramp inverted across its own first step
  // and the least trustworthy call in the file was the most visible.
  expect(qualityFade(0, true)).toBe(0)
  expect(qualityFade(0, true)).toBeLessThan(qualityFade(1, true))
})

test('quality ramps linearly to the opaque threshold', () => {
  expect(qualityFade(10, true)).toBeCloseTo(0.2, 9)
  expect(qualityFade(25, true)).toBeCloseTo(0.5, 9)
  expect(qualityFade(50, true)).toBe(1)
})

test('a quality past the threshold clamps rather than over-saturating', () => {
  expect(qualityFade(93, true)).toBe(1)
})
