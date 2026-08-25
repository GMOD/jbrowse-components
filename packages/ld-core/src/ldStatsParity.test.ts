import { LD_NOT_COMPUTED } from './ldNotComputed.ts'
import {
  dprimeFinalize,
  ldEnoughGametes,
  ldEnoughGenotypes,
  ldGenotypeAlleleFreq,
  ldGenotypeCorrelation,
  ldGenotypeD,
  ldHaplotypeCorrelation,
  ldLociPolymorphic,
  ldRSquared,
  ldValueComputed,
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
  // Haplotypic D cannot exceed Dmax, so on phased data the clamp is a guard
  // against float noise. The COMPOSITE D' is a different statistic and the
  // clamp is load-bearing there: it normalizes by allele frequencies alone,
  // which say nothing about the Hardy-Weinberg departure that inflated the
  // numerator, so D/Dmax runs past 1 by a wide margin on real genotypes —
  // 1.6053 in `compositeDprimeClamp.test.ts`, not a rounding step. The clamp
  // is what keeps the color ramp in its domain on both backends; what it hides
  // is that test's subject.
  expect(dprimeFinalize(0.9, 0.5, 0.5, false)).toBe(1)
  expect(dprimeFinalize(-0.9, 0.5, 0.5, true)).toBe(-1)
  expect(dprimeFinalize(-0.9, 0.5, 0.5, false)).toBe(1)
})

// `LD_NOT_COMPUTED` is a value, not a flag beside the buffer, so what makes it
// safe is that it lands outside every value an estimator can produce — and both
// renderers, the two shaders through this same generated function, ask
// `ldValueComputed` before painting.
describe('the not-computed sentinel', () => {
  // Feasible (pA, pB, D) only — D past its Lewontin bound describes gamete
  // counts no callset can produce, and `ldHaplotypeCorrelation` divides rather
  // than clamps, so feeding it one says nothing about what a cell can hold.
  test('no metric any estimator returns reads as not-computed', () => {
    for (const pA of FREQS.filter(p => p > 0 && p < 1)) {
      for (const pB of FREQS.filter(p => p > 0 && p < 1)) {
        const dmax = Math.min(pA * (1 - pB), (1 - pA) * pB)
        const dmin = -Math.min(pA * pB, (1 - pA) * (1 - pB))
        for (const t of [-1, -0.5, -0.001, 0, 0.001, 0.5, 1]) {
          const D = t < 0 ? -t * dmin : t * dmax
          const r = ldHaplotypeCorrelation(D, pA, pB)
          expect(ldValueComputed(r)).toBe(true)
          expect(ldValueComputed(ldRSquared(r))).toBe(true)
          for (const signed of [false, true]) {
            expect(ldValueComputed(dprimeFinalize(D, pA, pB, signed))).toBe(
              true,
            )
          }
        }
      }
    }
  })

  // Signed r is the one metric that reaches a buffer unclamped, so a perfect -1
  // can arrive a few ulps low. The test has to sit clear of that.
  test('a correlation of -1 stays computed even a few ulps below', () => {
    for (const v of [-1, -1.0000001, -1.001, -1.4]) {
      expect(ldValueComputed(v)).toBe(true)
    }
  })

  test('survives the Float32Array the matrix travels in', () => {
    const buf = new Float32Array([LD_NOT_COMPUTED, 0, -1, 1])
    expect(ldValueComputed(buf[0]!)).toBe(false)
    expect(buf[0]).toBe(LD_NOT_COMPUTED)
    expect([...buf].slice(1).every(v => ldValueComputed(v))).toBe(true)
  })
})

// The degenerate-input gates, lifted after the estimators above them were. They
// were the last thing between the moments and a generated answer: every path
// restated them, and the polymorphism test was written out in FOUR places (both
// kernels, both CPU fallbacks). Simple enough that nobody expected them to
// drift, which is the same reason nobody would have noticed.
describe('the degenerate-input gates', () => {
  // `calculateLDStats.ts` and `calculateLDStatsPhased.ts`, verbatim.
  const retiredEnoughGenotypes = (n: number) => !(n < 2)
  const retiredEnoughGametes = (total: number) => !(total < 4)
  const retiredAlleleFreq = (sum: number, n: number) => sum / (2 * n)
  const retiredPolymorphic = (pA: number, pB: number) =>
    !(pA <= 0 || pA >= 1 || pB <= 0 || pB >= 1)

  test('ldEnoughGenotypes / ldEnoughGametes match the twins they replaced', () => {
    for (const n of [0, 1, 1.5, 2, 2.5, 3, 4, 5, 1000]) {
      expect(ldEnoughGenotypes(n)).toBe(retiredEnoughGenotypes(n))
      expect(ldEnoughGametes(n)).toBe(retiredEnoughGametes(n))
    }
  })

  test('ldLociPolymorphic matches the twin it replaced', () => {
    // Includes the ends themselves, which is where the strictness lives: a
    // frequency of exactly 0 or 1 is fixed, and `<`/`<=` disagreeing between a
    // kernel and its fallback would show only on those cells.
    for (const pA of FREQS) {
      for (const pB of FREQS) {
        expect(ldLociPolymorphic(pA, pB)).toBe(retiredPolymorphic(pA, pB))
      }
    }
    expect(ldLociPolymorphic(0, 0.5)).toBe(false)
    expect(ldLociPolymorphic(1, 0.5)).toBe(false)
    expect(ldLociPolymorphic(0.5, 0)).toBe(false)
    expect(ldLociPolymorphic(0.5, 1)).toBe(false)
    expect(ldLociPolymorphic(0.01, 0.99)).toBe(true)
  })

  test('ldGenotypeAlleleFreq matches the twin it replaced', () => {
    for (const g1 of DOSAGE_VECTORS) {
      const { s1, n } = momentsOf(g1, g1)
      expect(ldGenotypeAlleleFreq(s1, n)).toBeCloseTo(
        retiredAlleleFreq(s1, n),
        12,
      )
    }
  })

  test('the ploidy divisor is 2, so an all-alt locus is fixed at 1', () => {
    // The property the 2 exists for: dosages run 0..2 per sample, so the
    // frequency's denominator is 2n and not n. Halving it makes every locus look
    // rare, which D' normalizes against and quietly rescales.
    const { s1, n } = momentsOf([2, 2, 2, 2], [2, 2, 2, 2])
    expect(ldGenotypeAlleleFreq(s1, n)).toBe(1)
    expect(ldLociPolymorphic(ldGenotypeAlleleFreq(s1, n), 0.5)).toBe(false)
    const het = momentsOf([1, 1, 1, 1], [1, 1, 1, 1])
    expect(ldGenotypeAlleleFreq(het.s1, het.n)).toBe(0.5)
  })
})
