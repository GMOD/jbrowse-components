import { dprimeFinalize } from './dprimeFinalize.generated.ts'

// The retirement gate for ldUniforms.slang's `//! js-export` (adr-051).
//
// `retiredCalculateDprime` is `calculateLDStats.ts`'s hand-written twin,
// verbatim. This one matters more than a pixel twin: LD has a WebGPU compute
// path AND this CPU path — picked by GPU availability and by a work threshold
// below which dispatch overhead dominates — so a drift is two users reading
// different r²/D' off the same data, not a slightly different-looking mark.
//
// The sweep favours the degenerate denominators, which is where a D'
// implementation actually goes wrong: a monomorphic locus (p = 0 or 1) drives
// Dmax to 0, and the signed/unsigned split has its own branch on D < 0.

function retiredCalculateDprime(
  D: number,
  pA: number,
  pB: number,
  signedLD: boolean,
): number {
  const qA = 1 - pA
  const qB = 1 - pB

  if (D > 0) {
    const Dmax = Math.min(pA * qB, qA * pB)
    if (Dmax > 0) {
      return Math.min(1, D / Dmax)
    }
  } else if (D < 0) {
    const absDmin = Math.min(pA * pB, qA * qB)
    if (absDmin > 0) {
      return signedLD
        ? Math.max(-1, D / absDmin)
        : Math.min(1, Math.abs(D) / absDmin)
    }
  }
  return 0
}

const DS = [-0.25, -0.1, -0.001, 0, 0.001, 0.1, 0.25]
// 0 and 1 are the monomorphic ends, where the denominators collapse.
const FREQS = [0, 0.01, 0.1, 0.3, 0.5, 0.7, 0.9, 0.99, 1]

test('the generated dprimeFinalize reproduces the hand-written twin it replaced', () => {
  for (const D of DS) {
    for (const pA of FREQS) {
      for (const pB of FREQS) {
        for (const signed of [false, true]) {
          expect(dprimeFinalize(D, pA, pB, signed)).toBeCloseTo(
            retiredCalculateDprime(D, pA, pB, signed),
            9,
          )
        }
      }
    }
  }
})

test('a monomorphic locus reports 0 rather than dividing by zero', () => {
  for (const D of DS) {
    for (const signed of [false, true]) {
      expect(dprimeFinalize(D, 0, 0.5, signed)).toBe(0)
      expect(dprimeFinalize(D, 1, 0.5, signed)).toBe(0)
      expect(dprimeFinalize(D, 0.5, 0, signed)).toBe(0)
      expect(dprimeFinalize(D, 0.5, 1, signed)).toBe(0)
    }
  }
})

test('signed keeps the sign, unsigned reports magnitude', () => {
  // The one branch where the two modes differ. Complete LD in repulsion has
  // D' = -1 signed and +1 unsigned; reporting the unsigned value in signed mode
  // would flip the heatmap's whole meaning for repulsion-phase pairs.
  const D = -0.25
  expect(dprimeFinalize(D, 0.5, 0.5, true)).toBeCloseTo(-1, 9)
  expect(dprimeFinalize(D, 0.5, 0.5, false)).toBeCloseTo(1, 9)
})

test('D of exactly 0 is no linkage in either mode', () => {
  expect(dprimeFinalize(0, 0.5, 0.5, true)).toBe(0)
  expect(dprimeFinalize(0, 0.5, 0.5, false)).toBe(0)
})

test('D’ is clamped into range rather than overflowing', () => {
  // D cannot exceed Dmax for real data, but a composite estimator on unphased
  // genotypes can overshoot slightly; the clamp is what keeps the color ramp in
  // its domain on both backends.
  expect(dprimeFinalize(0.9, 0.5, 0.5, false)).toBe(1)
  expect(dprimeFinalize(-0.9, 0.5, 0.5, true)).toBe(-1)
  expect(dprimeFinalize(-0.9, 0.5, 0.5, false)).toBe(1)
})
