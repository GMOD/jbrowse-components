import {
  dprimeFinalize,
  ldGenotypeCorrelation,
  ldGenotypeD,
  ldHaplotypeCorrelation,
  ldRSquared,
} from './ldStats.generated.ts'

// The retirement gate for ldUniforms.slang's `//! js-export` (adr-051).
//
// The `retired*` functions below are the hand-written twins from
// `calculateLDStats.ts` and `calculateLDStatsPhased.ts`, verbatim. These matter
// more than a pixel twin: LD has a WebGPU compute path AND these CPU paths —
// picked by GPU availability and by a work threshold below which dispatch
// overhead dominates — so a drift is two users reading different r²/D' off the
// same data, not a slightly different-looking mark.
//
// The sweeps favour the degenerate denominators, which is where these actually
// go wrong: a monomorphic locus (p = 0 or 1) drives Dmax to 0, a locus with no
// variance drives the correlation's denominator to 0, and the signed/unsigned
// split has its own branch on D < 0.

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

// The unphased r/D pair, as `calculateLDStats.ts` computed them inline.
function retiredGenotypeStats(
  s1: number,
  s2: number,
  s1sq: number,
  s2sq: number,
  sprod: number,
  n: number,
) {
  const mean1 = s1 / n
  const mean2 = s2 / n
  const var1 = s1sq / n - mean1 * mean1
  const var2 = s2sq / n - mean2 * mean2
  let r = 0
  let r2 = 0
  if (var1 > 0 && var2 > 0) {
    const cov = sprod / n - mean1 * mean2
    r = cov / Math.sqrt(var1 * var2)
    r2 = Math.min(1, Math.max(0, r * r))
  }
  const covG = sprod / n - mean1 * mean2
  return { r, r2, D: covG / 2 }
}

// …and the phased one, from `calculateLDStatsPhased.ts`.
function retiredHaplotypeStats(D: number, pA: number, pB: number) {
  const denom = pA * (1 - pA) * pB * (1 - pB)
  const r = denom > 0 ? D / Math.sqrt(denom) : 0
  return { r, r2: Math.min(1, Math.max(0, r * r)) }
}

// Moments as the accumulation loop produces them: sums of 0/1/2 dosages over
// `n` called samples. Generated from real dosage vectors rather than made up,
// so `sumG1sq >= sumG1` and the other invariants between them hold.
function momentsOf(g1: readonly number[], g2: readonly number[]) {
  let s1 = 0
  let s2 = 0
  let s1sq = 0
  let s2sq = 0
  let sprod = 0
  for (const [i, a] of g1.entries()) {
    const b = g2[i]!
    s1 += a
    s2 += b
    s1sq += a * a
    s2sq += b * b
    sprod += a * b
  }
  return { s1, s2, s1sq, s2sq, sprod, n: g1.length }
}

const DOSAGE_VECTORS = [
  [0, 0, 0, 0], // no variance at all: the correlation's denominator collapses
  [2, 2, 2, 2],
  [0, 1, 2, 1],
  [0, 0, 1, 2],
  [2, 1, 0, 0],
  [0, 2, 0, 2],
  [1, 1, 1, 2],
]

test('the generated genotype r/D reproduce the hand-written twins', () => {
  for (const g1 of DOSAGE_VECTORS) {
    for (const g2 of DOSAGE_VECTORS) {
      const { s1, s2, s1sq, s2sq, sprod, n } = momentsOf(g1, g2)
      const want = retiredGenotypeStats(s1, s2, s1sq, s2sq, sprod, n)
      const r = ldGenotypeCorrelation(s1, s2, s1sq, s2sq, sprod, n)
      expect(r).toBeCloseTo(want.r, 9)
      expect(ldRSquared(r)).toBeCloseTo(want.r2, 9)
      expect(ldGenotypeD(s1, s2, sprod, n)).toBeCloseTo(want.D, 9)
    }
  }
})

test('a locus with no variance reports r = 0 rather than NaN', () => {
  // Monomorphic at locus 1. The old code guarded this with `var1 > 0 && var2 >
  // 0` and the shader with the same test — reaching the ramp as NaN would paint
  // an unfilled cell on one backend and a clamped one on the other.
  const { s1, s2, s1sq, s2sq, sprod, n } = momentsOf([1, 1, 1, 1], [0, 1, 2, 1])
  expect(ldGenotypeCorrelation(s1, s2, s1sq, s2sq, sprod, n)).toBe(0)
  expect(ldRSquared(0)).toBe(0)
})

test('the generated haplotype r reproduces the hand-written twin', () => {
  for (const pA of FREQS) {
    for (const pB of FREQS) {
      for (const D of DS) {
        const want = retiredHaplotypeStats(D, pA, pB)
        const r = ldHaplotypeCorrelation(D, pA, pB)
        expect(r).toBeCloseTo(want.r, 9)
        expect(ldRSquared(r)).toBeCloseTo(want.r2, 9)
      }
    }
  }
})

test('r² is clamped, since a composite estimator can overshoot 1', () => {
  expect(ldRSquared(1.0000001)).toBe(1)
  expect(ldRSquared(-1.0000001)).toBe(1)
  expect(ldRSquared(-0.5)).toBeCloseTo(0.25, 9)
})

test('D’ is clamped into range rather than overflowing', () => {
  // D cannot exceed Dmax for real data, but a composite estimator on unphased
  // genotypes can overshoot slightly; the clamp is what keeps the color ramp in
  // its domain on both backends.
  expect(dprimeFinalize(0.9, 0.5, 0.5, false)).toBe(1)
  expect(dprimeFinalize(-0.9, 0.5, 0.5, true)).toBe(-1)
  expect(dprimeFinalize(-0.9, 0.5, 0.5, false)).toBe(1)
})
