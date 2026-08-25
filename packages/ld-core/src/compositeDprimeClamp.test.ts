import {
  calculateLDStatsDosageBits,
  packDosages,
} from './calculateLDStatsDosage.ts'
import {
  calculateLDStatsPhasedBits,
  packHaplotypesWithCounts,
} from './calculateLDStatsPhased.ts'
import { ldGenotypeAlleleFreq, ldGenotypeD } from './ldStats.generated.ts'

// What `ldMethod: 'composite'` on a phased callset costs, measured rather than
// asserted from the estimator's derivation. The two statistics coincide under
// Hardy-Weinberg, and the interesting question is what each does when the
// genotypes depart from it: r² drifts a few percent, which is the documented
// approximation; **D' does not drift, it saturates**, and `dprimeFinalize`'s
// clamp then makes the saturation indistinguishable from perfect linkage.
//
// The clamp itself is right — the value indexes a color ramp and is printed in
// a tooltip, and 1.6 is in neither domain. What this pins is the size of what
// it hides, since the shader comment beside it used to call the overshoot
// "slight".

const N = 200

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/**
 * One haplotype pair per sample from gamete frequencies with D = 0.16, then an
 * excess-homozygosity dial: with probability `knob` a sample's second haplotype
 * is a copy of its first. Gamete frequencies are untouched, so the exact
 * haplotypic LD is what it was; what moves is the genotype distribution, which
 * is the only thing the composite estimator sees.
 */
function simulate(knob: number, seed: number) {
  const rand = rng(seed)
  const pA = 0.3
  const pB = 0.25
  const D = 0.16
  const p11 = pA * pB + D
  const p10 = pA * (1 - pB) - D
  const p01 = (1 - pA) * pB - D
  const drawHap = () => {
    const u = rand()
    if (u < p11) {
      return [1, 1]
    }
    if (u < p11 + p10) {
      return [1, 0]
    }
    if (u < p11 + p10 + p01) {
      return [0, 1]
    }
    return [0, 0]
  }
  const gtA: Record<string, string> = {}
  const gtB: Record<string, string> = {}
  const dosA = new Int8Array(N)
  const dosB = new Int8Array(N)
  const samples = Array.from({ length: N }, (_, i) => `s${i}`)
  for (let i = 0; i < N; i++) {
    const h1 = drawHap()
    const h2 = rand() < knob ? h1 : drawHap()
    gtA[samples[i]!] = `${h1[0]}|${h2[0]}`
    gtB[samples[i]!] = `${h1[1]}|${h2[1]}`
    dosA[i] = h1[0]! + h2[0]!
    dosB[i] = h1[1]! + h2[1]!
  }
  return { samples, gtA, gtB, dosA, dosB }
}

function statsAt(knob: number) {
  const { samples, gtA, gtB, dosA, dosB } = simulate(knob, 12345)
  const haplotypic = calculateLDStatsPhasedBits(
    packHaplotypesWithCounts(gtA, samples),
    packHaplotypesWithCounts(gtB, samples),
    false,
  )
  const composite = calculateLDStatsDosageBits(
    packDosages(dosA),
    packDosages(dosB),
    false,
  )
  // The ratio `dprimeFinalize` clamps, rebuilt from the same moments it is
  // handed, so the number below is what the clamp removed and not an estimate
  // of it.
  let s1 = 0
  let s2 = 0
  let sprod = 0
  for (let i = 0; i < N; i++) {
    s1 += dosA[i]!
    s2 += dosB[i]!
    sprod += dosA[i]! * dosB[i]!
  }
  const pA = ldGenotypeAlleleFreq(s1, N)
  const pB = ldGenotypeAlleleFreq(s2, N)
  const rawDprime =
    ldGenotypeD(s1, s2, sprod, N) / Math.min(pA * (1 - pB), (1 - pA) * pB)
  return { haplotypic, composite, rawDprime }
}

test('r² tracks the haplotypic value through the Hardy-Weinberg departure', () => {
  for (const knob of [0, 0.3, 0.5, 0.7, 0.9]) {
    const { haplotypic, composite } = statsAt(knob)
    // 0.65639/0.65029 at knob 0 up to 0.55402/0.55498 at 0.9 — under 5% apart
    // everywhere, which is the approximation the D' menu row describes.
    expect(Math.abs(composite.r2 - haplotypic.r2) / haplotypic.r2).toBeLessThan(
      0.05,
    )
  }
})

test("D' saturates instead, and the clamp is what hides it", () => {
  // Under Hardy-Weinberg the two agree and nothing is clamped.
  const equilibrium = statsAt(0)
  expect(equilibrium.rawDprime).toBeCloseTo(0.8386, 3)
  expect(equilibrium.composite.dprime).toBeCloseTo(0.8386, 3)
  expect(equilibrium.haplotypic.dprime).toBeCloseTo(0.8677, 3)

  // Away from it the composite ratio runs well past 1 while the exact
  // haplotypic D' on the same gametes barely moves. 1.6053, not 1.0001.
  const skewed = statsAt(0.9)
  expect(skewed.rawDprime).toBeCloseTo(1.6053, 3)
  expect(skewed.haplotypic.dprime).toBeCloseTo(0.8385, 3)

  // And every clamped cell reads as an exact 1, which is also what a genuine
  // perfect-linkage pair reads as: nothing on screen tells them apart.
  for (const knob of [0.3, 0.5, 0.7, 0.9]) {
    const { composite, haplotypic } = statsAt(knob)
    expect(composite.dprime).toBe(1)
    expect(haplotypic.dprime).toBeLessThan(0.94)
  }
})
