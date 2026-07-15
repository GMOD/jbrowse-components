import { calculateDprime } from './calculateLDStats.ts'
import {
  calculateLDStatsPhasedBits,
  packHaplotypesWithCounts,
} from './calculateLDStatsPhased.ts'

// Brute-force reference: count the four two-locus haplotype configurations over
// both gametes directly from the genotype strings, then apply the textbook
// haplotypic formulas. The bit-packed production path must match this exactly.
function referencePhasedLD(
  g1: Record<string, string>,
  g2: Record<string, string>,
  samples: string[],
  signedLD = false,
) {
  let n01 = 0
  let n10 = 0
  let n11 = 0
  let total = 0
  const allele = (gt: string, hap: number) => {
    const parts = gt.split('|')
    return parts.length === 2 ? parts[hap]! : '.'
  }
  for (const s of samples) {
    for (const hap of [0, 1]) {
      const a = allele(g1[s]!, hap)
      const b = allele(g2[s]!, hap)
      if (a !== '.' && b !== '.') {
        const altA = a !== '0'
        const altB = b !== '0'
        if (altA && altB) {
          n11++
        } else if (altA && !altB) {
          n10++
        } else if (!altA && altB) {
          n01++
        }
        total++
      }
    }
  }
  if (total < 4) {
    return { r2: 0, dprime: 0 }
  }
  const pA = (n10 + n11) / total
  const pB = (n01 + n11) / total
  if (pA <= 0 || pA >= 1 || pB <= 0 || pB >= 1) {
    return { r2: 0, dprime: 0 }
  }
  const D = n11 / total - pA * pB
  const denom = pA * (1 - pA) * pB * (1 - pB)
  const r = denom > 0 ? D / Math.sqrt(denom) : 0
  return {
    r2: signedLD ? r : Math.min(1, Math.max(0, r * r)),
    dprime: calculateDprime(D, pA, pB, signedLD),
  }
}

function bitLD(
  g1: Record<string, string>,
  g2: Record<string, string>,
  samples: string[],
  signedLD = false,
) {
  return calculateLDStatsPhasedBits(
    packHaplotypesWithCounts(g1, samples),
    packHaplotypesWithCounts(g2, samples),
    signedLD,
  )
}

// Deterministic pseudo-random generator so the fuzz cases are reproducible
// (Math.random would make failures non-repeatable).
function lcg(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

describe('calculateLDStatsPhasedBits', () => {
  it('gives perfect LD for identical phased haplotypes', () => {
    const samples = ['a', 'b', 'c', 'd']
    const g = { a: '0|0', b: '0|1', c: '1|0', d: '1|1' }
    const stats = bitLD(g, g, samples)
    expect(stats.r2).toBeCloseTo(1)
    expect(stats.dprime).toBeCloseTo(1)
  })

  it('distinguishes cis (coupling) from trans (repulsion) with signed LD', () => {
    const samples = ['a', 'b', 'c', 'd']
    const cisA = { a: '0|1', b: '0|1', c: '0|1', d: '0|1' }
    const cisB = { a: '0|1', b: '0|1', c: '0|1', d: '0|1' }
    const transB = { a: '1|0', b: '1|0', c: '1|0', d: '1|0' }
    expect(bitLD(cisA, cisB, samples, true).dprime).toBeCloseTo(1)
    expect(bitLD(cisA, transB, samples, true).dprime).toBeCloseTo(-1)
  })

  it('excludes half-missing haplotypes pairwise', () => {
    const samples = ['a', 'b', 'c', 'd']
    // Locus1 h2 missing for a; locus2 fully called. That gamete drops out.
    const g1 = { a: '0|.', b: '0|1', c: '1|0', d: '1|1' }
    const g2 = { a: '0|0', b: '0|1', c: '1|0', d: '1|1' }
    expect(bitLD(g1, g2, samples)).toEqual(referencePhasedLD(g1, g2, samples))
  })

  it('treats unphased / haploid entries in a phased file as missing', () => {
    const samples = ['a', 'b', 'c', 'd', 'e']
    const g1 = { a: '0|1', b: '0|1', c: '0/1', d: '1', e: '1|1' }
    const g2 = { a: '0|1', b: '0|1', c: '0|1', d: '0|1', e: '1|1' }
    // c (unphased) and d (haploid) contribute nothing; result matches the
    // reference, which also ignores non-'|' genotypes.
    expect(bitLD(g1, g2, samples)).toEqual(referencePhasedLD(g1, g2, samples))
  })

  it('matches the brute-force reference across many fuzzed pairs (>32 samples, multi-word)', () => {
    const rand = lcg(0xc0ffee)
    const nSamples = 100
    const samples = Array.from({ length: nSamples }, (_, i) => `s${i}`)
    const genoFor = (p: number, miss: number) => {
      const g: Record<string, string> = {}
      for (const s of samples) {
        const h = () => (rand() < miss ? '.' : rand() < p ? '1' : '0')
        g[s] = `${h()}|${h()}`
      }
      return g
    }
    for (let t = 0; t < 40; t++) {
      const g1 = genoFor(0.2 + rand() * 0.6, rand() * 0.2)
      const g2 = genoFor(0.2 + rand() * 0.6, rand() * 0.2)
      for (const signed of [false, true]) {
        const bit = bitLD(g1, g2, samples, signed)
        const ref = referencePhasedLD(g1, g2, samples, signed)
        expect(bit.r2).toBeCloseTo(ref.r2, 6)
        expect(bit.dprime).toBeCloseTo(ref.dprime, 6)
      }
    }
  })

  it('handles multi-digit (multiallelic) phased alleles via the general path', () => {
    const samples = ['a', 'b', 'c', 'd']
    const g1 = { a: '0|10', b: '10|0', c: '0|0', d: '10|10' }
    const g2 = { a: '0|1', b: '1|0', c: '0|0', d: '1|1' }
    expect(bitLD(g1, g2, samples)).toEqual(referencePhasedLD(g1, g2, samples))
  })
})
