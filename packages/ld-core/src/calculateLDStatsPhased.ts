import {
  dprimeFinalize,
  ldEnoughGametes,
  ldHaplotypeCorrelation,
  ldLociPolymorphic,
  ldRSquared,
} from './ldStats.generated.ts'
import { popcount32 } from './popcount.ts'

const PIPE_CODE = 124 // '|'
const ZERO_CODE = 48 // '0'
const DOT_CODE = 46 // '.'

export interface PackedHaplotypes {
  altH1: Uint32Array
  validH1: Uint32Array
  altH2: Uint32Array
  validH2: Uint32Array
  words: number
}

export interface HaplotypeCounts {
  nHomRef: number
  nHet: number
  nHomAlt: number
  nValid: number
  // Allele-level totals, counted per haplotype rather than per genotype: a
  // half-call contributes its one called allele even though it is not a valid
  // genotype for HWE. Minor allele frequency reads these, so it matches the
  // multi-sample displays' AN-style definition instead of assuming every
  // counted sample carries exactly two called alleles.
  nCalledAlleles: number
  nAltAlleles: number
}

/**
 * Bit-pack a phased genotype map into two haplotype planes (one bit per sample
 * per plane): `altH*` marks alt alleles, `validH*` marks called alleles. Each
 * 32-bit word covers 32 samples so `calculateLDStatsPhasedBits` can count
 * haplotype configurations with popcount instead of a per-sample loop.
 *
 * Genotypes without a `|` separator (unphased or haploid entries in an
 * otherwise-phased file) are left as all-zero — i.e. treated as missing at both
 * loci — rather than guessed at. So is a sample with no genotype string at all,
 * which is not a corner case: @gmod/vcf returns an EMPTY map for a record whose
 * FORMAT declares no GT column, so every lookup here is `undefined` and reading
 * `.length` off one took the whole LD track down with a TypeError.
 */
export function packHaplotypesWithCounts(
  genotypes: Record<string, string>,
  samples: string[],
): PackedHaplotypes & HaplotypeCounts {
  const numSamples = samples.length
  const words = Math.ceil(numSamples / 32)
  const altH1 = new Uint32Array(words)
  const validH1 = new Uint32Array(words)
  const altH2 = new Uint32Array(words)
  const validH2 = new Uint32Array(words)
  let nHomRef = 0
  let nHet = 0
  let nHomAlt = 0
  let nValid = 0
  let nCalledAlleles = 0
  let nAltAlleles = 0
  for (let s = 0; s < numSamples; s++) {
    const val = genotypes[samples[s]!]
    if (val === undefined) {
      continue
    }
    const len = val.length

    if (len === 3 && val.charCodeAt(1) === PIPE_CODE) {
      // Fast path: 3-char phased "X|Y" — avoids indexOf/slice allocation
      const c0 = val.charCodeAt(0)
      const c1 = val.charCodeAt(2)
      const w = s >>> 5
      const bit = 1 << (s & 31)
      const v0 = c0 !== DOT_CODE
      const v1 = c1 !== DOT_CODE
      if (v0) {
        validH1[w] = validH1[w]! | bit
        nCalledAlleles++
        if (c0 !== ZERO_CODE) {
          altH1[w] = altH1[w]! | bit
          nAltAlleles++
        }
      }
      if (v1) {
        validH2[w] = validH2[w]! | bit
        nCalledAlleles++
        if (c1 !== ZERO_CODE) {
          altH2[w] = altH2[w]! | bit
          nAltAlleles++
        }
      }
      if (v0 && v1) {
        nValid++
        const isAlt0 = c0 !== ZERO_CODE
        const isAlt1 = c1 !== ZERO_CODE
        if (!isAlt0 && !isAlt1) {
          nHomRef++
        } else if (isAlt0 && isAlt1) {
          nHomAlt++
        } else {
          nHet++
        }
      }
      continue
    }

    // General path: multi-digit alleles or non-standard ploidy
    const pipe = val.indexOf('|')
    if (pipe === -1) {
      continue
    }
    const a0 = val.slice(0, pipe)
    const a1 = val.slice(pipe + 1)
    const w = s >>> 5
    const bit = 1 << (s & 31)
    const v0 = a0 !== '.'
    const v1 = a1 !== '.'
    if (v0) {
      validH1[w] = validH1[w]! | bit
      nCalledAlleles++
      if (a0 !== '0') {
        altH1[w] = altH1[w]! | bit
        nAltAlleles++
      }
    }
    if (v1) {
      validH2[w] = validH2[w]! | bit
      nCalledAlleles++
      if (a1 !== '0') {
        altH2[w] = altH2[w]! | bit
        nAltAlleles++
      }
    }
    if (v0 && v1) {
      nValid++
      const isAlt0 = a0 !== '0'
      const isAlt1 = a1 !== '0'
      if (!isAlt0 && !isAlt1) {
        nHomRef++
      } else if (isAlt0 && isAlt1) {
        nHomAlt++
      } else {
        nHet++
      }
    }
  }
  return {
    altH1,
    validH1,
    altH2,
    validH2,
    words,
    nHomRef,
    nHet,
    nHomAlt,
    nValid,
    nCalledAlleles,
    nAltAlleles,
  }
}

/**
 * Exact haplotypic r²/D' between two SNPs from bit-packed phased haplotypes.
 * Counts the four two-locus haplotype configurations across the 2N gametes,
 * then D = P(AB) - P(A)P(B), r² = D²/(pA·qA·pB·qB), D' = Lewontin normalization.
 * When `signedLD` is true, returns r (correlation) in the r2 field instead of r².
 *
 * `alt` bits are a strict subset of `valid` bits (an alt allele is a called
 * allele), so `altI & altJ` needs no extra validity mask.
 */
export function calculateLDStatsPhasedBits(
  a: PackedHaplotypes,
  b: PackedHaplotypes,
  signedLD = false,
): { r2: number; dprime: number } {
  let n01 = 0
  let n10 = 0
  let n11 = 0
  let total = 0
  const words = a.words
  for (let w = 0; w < words; w++) {
    const ai1 = a.altH1[w]!
    const vi1 = a.validH1[w]!
    const aj1 = b.altH1[w]!
    const vj1 = b.validH1[w]!
    n11 += popcount32(ai1 & aj1)
    n10 += popcount32(ai1 & ~aj1 & vj1)
    n01 += popcount32(vi1 & ~ai1 & aj1)
    total += popcount32(vi1 & vj1)
    const ai2 = a.altH2[w]!
    const vi2 = a.validH2[w]!
    const aj2 = b.altH2[w]!
    const vj2 = b.validH2[w]!
    n11 += popcount32(ai2 & aj2)
    n10 += popcount32(ai2 & ~aj2 & vj2)
    n01 += popcount32(vi2 & ~ai2 & aj2)
    total += popcount32(vi2 & vj2)
  }
  if (!ldEnoughGametes(total)) {
    return { r2: 0, dprime: 0 }
  }
  const p01 = n01 / total
  const p10 = n10 / total
  const p11 = n11 / total
  const pA = p10 + p11
  const pB = p01 + p11
  if (!ldLociPolymorphic(pA, pB)) {
    return { r2: 0, dprime: 0 }
  }
  // Shared with ldPhasedCompute.slang, this function's WebGPU counterpart —
  // see the note at the top of calculateLDStats.ts.
  const D = p11 - pA * pB
  const r = ldHaplotypeCorrelation(D, pA, pB)
  const dprime = dprimeFinalize(D, pA, pB, signedLD)
  return { r2: signedLD ? r : ldRSquared(r), dprime }
}
