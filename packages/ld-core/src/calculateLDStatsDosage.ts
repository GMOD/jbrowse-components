import {
  dprimeFinalize,
  ldEnoughGenotypes,
  ldGenotypeAlleleFreq,
  ldGenotypeCorrelation,
  ldGenotypeD,
  ldLociPolymorphic,
  ldRSquared,
} from './ldStats.generated.ts'
import { popcount32 } from './popcount.ts'

/**
 * Genotype dosages as three bit planes, one bit per sample: `het` marks dosage
 * 1, `homAlt` marks dosage 2, `valid` marks a called genotype. Dosage 0 is a
 * sample present in `valid` and in neither of the other two, so the encoding
 * is exact rather than a summary, and `het` and `homAlt` are disjoint subsets
 * of `valid`.
 */
export interface PackedDosages {
  het: Uint32Array
  homAlt: Uint32Array
  valid: Uint32Array
  words: number
}

/**
 * Pack the dosages `fillEncoded` produces (0/1/2, -1 missing) into the planes
 * {@link calculateLDStatsDosageBits} reads.
 */
export function packDosages(dosages: Int8Array) {
  const numSamples = dosages.length
  const words = Math.ceil(numSamples / 32)
  const het = new Uint32Array(words)
  const homAlt = new Uint32Array(words)
  const valid = new Uint32Array(words)
  for (let s = 0; s < numSamples; s++) {
    const g = dosages[s]!
    if (g >= 0) {
      const w = s >>> 5
      const bit = 1 << (s & 31)
      valid[w] = valid[w]! | bit
      if (g === 1) {
        het[w] = het[w]! | bit
      } else if (g === 2) {
        homAlt[w] = homAlt[w]! | bit
      }
    }
  }
  return { het, homAlt, valid, words }
}

/**
 * Composite-LD r²/D' between two SNPs, from bit-packed dosages. The statistic
 * is {@link calculateLDStats}'s exactly — same six moments, same generated
 * finalizers — reached by popcount over 32 samples at a time instead of a
 * per-sample loop, which is what the phased path already does and is why it
 * runs several times faster than this one used to.
 *
 * The moments come out of the planes because dosage is `het + 2·homAlt`, so
 * across the samples called at BOTH loci:
 *
 * - `Σg  = |het| + 2|homAlt|`
 * - `Σg² = |het| + 4|homAlt|`, since 1² = 1 and 2² = 4
 * - `Σg₁g₂ = |het₁het₂| + 2|het₁homAlt₂| + 2|homAlt₁het₂| + 4|homAlt₁homAlt₂|`
 *
 * These are the same integers the scalar loop accumulates, not an
 * approximation of them, so the two agree to the bit and `calculateLDStats`
 * stays the readable statement of what this computes.
 *
 * A plane is a subset of its own `valid`, so a term drawn from both loci
 * (`het1 & homAlt2`) is already restricted to the called-at-both set and needs
 * no mask; a term drawn from one locus is masked by the other's `valid`.
 */
export function calculateLDStatsDosageBits(
  a: PackedDosages,
  b: PackedDosages,
  signedLD = false,
): {
  r2: number
  dprime: number
} {
  let n = 0
  let het1 = 0
  let homAlt1 = 0
  let het2 = 0
  let homAlt2 = 0
  let hetHet = 0
  let hetHom = 0
  let homHet = 0
  let homHom = 0
  const words = a.words

  for (let w = 0; w < words; w++) {
    const h1 = a.het[w]!
    const m1 = a.homAlt[w]!
    const v1 = a.valid[w]!
    const h2 = b.het[w]!
    const m2 = b.homAlt[w]!
    const v2 = b.valid[w]!
    n += popcount32(v1 & v2)
    het1 += popcount32(h1 & v2)
    homAlt1 += popcount32(m1 & v2)
    het2 += popcount32(h2 & v1)
    homAlt2 += popcount32(m2 & v1)
    hetHet += popcount32(h1 & h2)
    hetHom += popcount32(h1 & m2)
    homHet += popcount32(m1 & h2)
    homHom += popcount32(m1 & m2)
  }

  if (!ldEnoughGenotypes(n)) {
    return { r2: 0, dprime: 0 }
  }

  const sumG1 = het1 + 2 * homAlt1
  const sumG2 = het2 + 2 * homAlt2
  const sumG1sq = het1 + 4 * homAlt1
  const sumG2sq = het2 + 4 * homAlt2
  const sumProd = hetHet + 2 * hetHom + 2 * homHet + 4 * homHom

  const pA = ldGenotypeAlleleFreq(sumG1, n)
  const pB = ldGenotypeAlleleFreq(sumG2, n)

  if (!ldLociPolymorphic(pA, pB)) {
    return { r2: 0, dprime: 0 }
  }

  const r = ldGenotypeCorrelation(sumG1, sumG2, sumG1sq, sumG2sq, sumProd, n)
  const dprime = dprimeFinalize(
    ldGenotypeD(sumG1, sumG2, sumProd, n),
    pA,
    pB,
    signedLD,
  )

  return { r2: signedLD ? r : ldRSquared(r), dprime }
}
