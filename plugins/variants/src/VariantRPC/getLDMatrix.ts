import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { updateStatus } from '@jbrowse/core/util'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { firstValueFrom, toArray } from 'rxjs'

import {
  computeLDMatrixGPU,
  computeLDMatrixGPUPhased,
} from './getLDMatrixGPU.ts'
import { GENOTYPE_SPLITTER as SPLITTER } from '../shared/constants.ts'
import {
  encodeGenotypeFromRaw,
  getRawCallGenotype,
} from '../shared/rawGenotypes.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'
import type {
  StopToken,
  StopTokenChecker,
} from '@jbrowse/core/util/stopToken'
const SLASH_CODE = 47 // '/'
const PIPE_CODE = 124 // '|'
const ZERO_CODE = 48 // '0'
const DOT_CODE = 46 // '.'

function isPhased(genotypes: Record<string, string>): boolean {
  for (const k in genotypes) {
    return genotypes[k]!.includes('|')
  }
  return false
}

function isPhasedRaw(feature: Feature): boolean {
  const phased = feature.get('callGenotypePhased') as Uint8Array | undefined
  if (!phased) {
    return false
  }
  for (const element of phased) {
    if (element) {
      return true
    }
  }
  return false
}

/**
 * Fill `out` with encoded genotypes (0=hom ref, 1=het, 2=hom alt, -1=missing)
 * and return allele counts. Combines encoding and counting in a single pass.
 * Includes a diploid fast path that avoids per-sample function call overhead.
 */
function fillEncodedFromRaw(
  out: Int8Array,
  callGenotype: Int8Array,
  ploidy: number,
  nSamples: number,
) {
  let nHomRef = 0
  let nHet = 0
  let nHomAlt = 0
  let nValid = 0
  if (ploidy === 2) {
    for (let s = 0; s < nSamples; s++) {
      const off = s << 1
      const a0 = callGenotype[off]!
      const a1 = callGenotype[off + 1]!
      if (a0 >= 0 && a1 >= 0) {
        // Fast path: both alleles called. nonRef ∈ {0,1,2} directly encodes
        // the genotype; hoist nValid++ since both alleles are always valid here.
        nValid++
        const nonRef = (a0 !== 0 ? 1 : 0) + (a1 !== 0 ? 1 : 0)
        out[s] = nonRef
        if (nonRef === 0) {
          nHomRef++
        } else if (nonRef === 1) {
          nHet++
        } else {
          nHomAlt++
        }
      } else {
        // Slow path: missing (-1) or padding (-2)
        const g = encodeGenotypeFromRaw(callGenotype, s, 2)
        out[s] = g
        if (g === 0) {
          nHomRef++
          nValid++
        } else if (g === 1) {
          nHet++
          nValid++
        } else if (g === 2) {
          nHomAlt++
          nValid++
        }
      }
    }
  } else {
    for (let s = 0; s < nSamples; s++) {
      const g = encodeGenotypeFromRaw(callGenotype, s, ploidy)
      out[s] = g
      if (g === 0) {
        nHomRef++
        nValid++
      } else if (g === 1) {
        nHet++
        nValid++
      } else if (g === 2) {
        nHomAlt++
        nValid++
      }
    }
  }
  return { nHomRef, nHet, nHomAlt, nValid }
}

export function packHaplotypesFromRaw(
  callGenotype: Int8Array,
  callGenotypePhased: Uint8Array | undefined,
  ploidy: number,
  nSamples: number,
) {
  const words = Math.ceil(nSamples / 32)
  const altH1 = new Uint32Array(words)
  const validH1 = new Uint32Array(words)
  const altH2 = new Uint32Array(words)
  const validH2 = new Uint32Array(words)
  let nHomRef = 0
  let nHet = 0
  let nHomAlt = 0
  let nValid = 0

  // A single loop handles all ploidies and both phased/unphased data. `ploidy`
  // is loop-invariant so V8 hoists the `ploidy > 1` and `callGenotypePhased &&`
  // checks; splitting into a diploid fast path / general path duplicated the
  // whole body for no measurable gain. Haploid (a1 stays -2) is excluded, as
  // before — LD needs a second allele per sample.
  for (let s = 0; s < nSamples; s++) {
    if (callGenotypePhased && !callGenotypePhased[s]) {
      continue
    }
    const off = s * ploidy
    const a0 = callGenotype[off]!
    const a1 = ploidy > 1 ? callGenotype[off + 1]! : -2
    if (a0 === -2 || a1 === -2) {
      continue
    }
    const w = s >>> 5
    const bit = 1 << (s & 31)
    const v0 = a0 !== -1
    const v1 = a1 !== -1
    const isAlt0 = a0 !== 0
    const isAlt1 = a1 !== 0
    if (v0) {
      validH1[w] = validH1[w]! | bit
      if (isAlt0) {
        altH1[w] = altH1[w]! | bit
      }
    }
    if (v1) {
      validH2[w] = validH2[w]! | bit
      if (isAlt1) {
        altH2[w] = altH2[w]! | bit
      }
    }
    if (v0 && v1) {
      nValid++
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
  }
}

/**
 * Calculate D' (normalized D) from D and allele frequencies
 * @param D - Linkage disequilibrium coefficient
 * @param pA - Frequency of alt allele at locus 1
 * @param pB - Frequency of alt allele at locus 2
 * @param signedLD - If true, return signed D' (-1 to 1), otherwise |D'| (0 to 1)
 */
function calculateDprime(
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
      // For signed: D/|Dmin| preserves negative sign
      // For unsigned: |D|/|Dmin|
      return signedLD
        ? Math.max(-1, D / absDmin)
        : Math.min(1, Math.abs(D) / absDmin)
    }
  }
  return 0
}

// Acklam's inverse standard normal CDF (accurate to ~1e-9).
function normalInverseCDF(p: number): number {
  const a1 = -3.969683028665376e1
  const a2 = 2.209460984245205e2
  const a3 = -2.759285104469687e2
  const a4 = 1.38357751867269e2
  const a5 = -3.066479806614716e1
  const a6 = 2.506628277459239
  const b1 = -5.447609879822406e1
  const b2 = 1.615858368580409e2
  const b3 = -1.556989798598866e2
  const b4 = 6.680131188771972e1
  const b5 = -1.328068155288572e1
  const c1 = -7.784894002430293e-3
  const c2 = -3.223964580411365e-1
  const c3 = -2.400758277161838
  const c4 = -2.549732539343734
  const c5 = 4.374664141464968
  const c6 = 2.938163982698783
  const d1 = 7.784695709041462e-3
  const d2 = 3.224671290700398e-1
  const d3 = 2.445134137142996
  const d4 = 3.754408661907416
  const pLow = 0.02425
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (
      (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    )
  }
  if (p <= 1 - pLow) {
    const q = p - 0.5
    const r = q * q
    return (
      ((((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q) /
      (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1)
    )
  }
  const q = Math.sqrt(-2 * Math.log(1 - p))
  return -(
    (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
    ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
  )
}

// χ²(df=1) critical at significance level p. Uses χ²(1) ≡ Z²: the critical is
// (Φ⁻¹(1 - p/2))². Matches df=1 table to 4 sig figs (p=0.05 → 3.841,
// p=0.01 → 6.635, p=0.001 → 10.83, p=0.0001 → 15.14).
function getChiSquareCritical(pValue: number): number {
  if (pValue <= 0) {
    return Number.POSITIVE_INFINITY
  }
  if (pValue >= 1) {
    return 0
  }
  const z = normalInverseCDF(1 - pValue / 2)
  return z * z
}

/**
 * Fill `out` with encoded genotypes and return allele counts.
 * Uses charCode fast path for the common 3-char diploid case ("X/Y", "X|Y")
 * to avoid split() allocation and iterator overhead.
 */
function fillEncoded(
  out: Int8Array,
  genotypes: Record<string, string>,
  samples: string[],
  splitCache: Record<string, string[]>,
) {
  let nHomRef = 0
  let nHet = 0
  let nHomAlt = 0
  let nValid = 0

  for (let i = 0; i < samples.length; i++) {
    const val = genotypes[samples[i]!]!
    const len = val.length

    if (len === 3) {
      const sep = val.charCodeAt(1)
      if (sep === SLASH_CODE || sep === PIPE_CODE) {
        const c0 = val.charCodeAt(0)
        const c1 = val.charCodeAt(2)
        if (c0 === DOT_CODE) {
          if (c1 === DOT_CODE) {
            out[i] = -1
          } else if (c1 === ZERO_CODE) {
            out[i] = 0
            nHomRef++
            nValid++
          } else {
            out[i] = 1
            nHet++
            nValid++
          }
        } else if (c1 === DOT_CODE) {
          if (c0 === ZERO_CODE) {
            out[i] = 0
            nHomRef++
            nValid++
          } else {
            out[i] = 1
            nHet++
            nValid++
          }
        } else {
          const isAlt0 = c0 !== ZERO_CODE
          const isAlt1 = c1 !== ZERO_CODE
          if (!isAlt0 && !isAlt1) {
            out[i] = 0
            nHomRef++
            nValid++
          } else if (isAlt0 && isAlt1) {
            out[i] = 2
            nHomAlt++
            nValid++
          } else {
            out[i] = 1
            nHet++
            nValid++
          }
        }
        continue
      }
    }

    // General case: haploid, polyploid, or multi-digit alleles
    const alleles = splitCache[val] ?? (splitCache[val] = val.split(SPLITTER))
    let nonRefCount = 0
    let uncalledCount = 0
    for (const allele of alleles) {
      if (allele === '.') {
        uncalledCount++
      } else if (allele !== '0') {
        nonRefCount++
      }
    }
    if (uncalledCount === alleles.length) {
      out[i] = -1
    } else if (nonRefCount === 0) {
      out[i] = 0
      nHomRef++
      nValid++
    } else if (nonRefCount === alleles.length) {
      out[i] = 2
      nHomAlt++
      nValid++
    } else {
      out[i] = 1
      nHet++
      nValid++
    }
  }

  return { nHomRef, nHet, nHomAlt, nValid }
}

function popcount32(v: number) {
  v = v | 0
  v -= (v >>> 1) & 0x55555555
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333)
  v = (v + (v >>> 4)) & 0x0f0f0f0f
  return Math.imul(v, 0x01010101) >>> 24
}

interface PackedHaplotypes {
  altH1: Uint32Array
  validH1: Uint32Array
  altH2: Uint32Array
  validH2: Uint32Array
  words: number
}

function packHaplotypesWithCounts(
  genotypes: Record<string, string>,
  samples: string[],
): PackedHaplotypes & {
  nHomRef: number
  nHet: number
  nHomAlt: number
  nValid: number
} {
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
  for (let s = 0; s < numSamples; s++) {
    const val = genotypes[samples[s]!]!
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
        if (c0 !== ZERO_CODE) {
          altH1[w] = altH1[w]! | bit
        }
      }
      if (v1) {
        validH2[w] = validH2[w]! | bit
        if (c1 !== ZERO_CODE) {
          altH2[w] = altH2[w]! | bit
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
      if (a0 !== '0') {
        altH1[w] = altH1[w]! | bit
      }
    }
    if (v1) {
      validH2[w] = validH2[w]! | bit
      if (a1 !== '0') {
        altH2[w] = altH2[w]! | bit
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
  }
}

// Phased haplotypes encode alleles as strictly {-1, 0, 1} (encodePhasedHaplotypes
// maps ref→0, missing→-1, any alt→1), so bit-packing is valid.
// Each 32-bit word covers 32 samples; popcount replaces the per-sample loop.
function calculateLDStatsPhasedBits(
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
  if (total < 4) {
    return { r2: 0, dprime: 0 }
  }
  const p01 = n01 / total
  const p10 = n10 / total
  const p11 = n11 / total
  const pA = p10 + p11
  const pB = p01 + p11
  const qA = 1 - pA
  const qB = 1 - pB
  if (pA <= 0 || pA >= 1 || pB <= 0 || pB >= 1) {
    return { r2: 0, dprime: 0 }
  }
  const D = p11 - pA * pB
  const denom = pA * qA * pB * qB
  const r = denom > 0 ? D / Math.sqrt(denom) : 0
  const r2 = Math.min(1, Math.max(0, r * r))
  const dprime = calculateDprime(D, pA, pB, signedLD)
  return { r2: signedLD ? r : r2, dprime }
}

export type LDMetric = 'r2' | 'dprime'

function calculateLDStats(
  geno1: Int8Array,
  geno2: Int8Array,
  signedLD = false,
): {
  r2: number
  dprime: number
} {
  let n = 0
  let sumG1 = 0
  let sumG2 = 0
  let sumG1sq = 0
  let sumG2sq = 0
  let sumProd = 0

  // Count haplotype frequencies from genotype data
  // For unphased diploid data, we estimate haplotype frequencies
  // using the composite approach
  //
  // Genotype encoding: 0=AA, 1=Aa, 2=aa (where A=ref, a=alt)
  // We count allele dosages and estimate haplotype freqs

  for (let i = 0; i < geno1.length; i++) {
    const g1 = geno1[i]!
    const g2 = geno2[i]!
    // Only include samples where both genotypes are called
    if (g1 >= 0 && g2 >= 0) {
      n++
      sumG1 += g1
      sumG2 += g2
      sumG1sq += g1 * g1
      sumG2sq += g2 * g2
      sumProd += g1 * g2
    }
  }

  // Need at least 2 samples
  if (n < 2) {
    return { r2: 0, dprime: 0 }
  }

  // Allele frequencies (frequency of alt allele)
  const pA = sumG1 / (2 * n)
  const pB = sumG2 / (2 * n)

  // If either locus is monomorphic, LD is undefined
  if (pA <= 0 || pA >= 1 || pB <= 0 || pB >= 1) {
    return { r2: 0, dprime: 0 }
  }

  // === R and R² calculation (PLINK style) ===
  // Pearson correlation of genotype dosages
  const mean1 = sumG1 / n
  const mean2 = sumG2 / n
  const var1 = sumG1sq / n - mean1 * mean1
  const var2 = sumG2sq / n - mean2 * mean2

  let r = 0
  let r2 = 0
  if (var1 > 0 && var2 > 0) {
    const cov = sumProd / n - mean1 * mean2
    r = cov / Math.sqrt(var1 * var2)
    r2 = Math.min(1, Math.max(0, r * r))
  }

  // === D' calculation ===
  // D = P(AB) - P(A)*P(B)
  // For unphased data, estimate D from genotype covariance
  // Under Hardy-Weinberg equilibrium: Cov(g1, g2) = 2D
  // So D = Cov(g1, g2) / 2 (composite LD estimator, Weir 1979)
  const covG = sumProd / n - mean1 * mean2
  const D = covG / 2

  const dprime = calculateDprime(D, pA, pB, signedLD)

  // For signed mode, return R instead of R²
  return { r2: signedLD ? r : r2, dprime }
}

export interface FilterStats {
  totalVariants: number
  passedVariants: number
  filteredByMaf: number
  filteredByLength: number
  filteredByMultiallelic: number
  filteredByHwe: number
  filteredByCallRate: number
}

export interface RecombinationData {
  // Recombination evidence between adjacent SNPs (1 - r²)
  // Length = n-1 for n SNPs
  values: Float32Array
  // Positions (midpoint between adjacent SNPs) for plotting
  positions: number[]
}

export interface LDSnp {
  id: string
  refName: string
  start: number
  end: number
}

export interface LDMatrixResult {
  snps: LDSnp[]
  ldValues: Float32Array
  metric: LDMetric
  filterStats: FilterStats
  recombination: RecombinationData
}

function emptyLDResult(metric: LDMetric): LDMatrixResult {
  return {
    snps: [],
    ldValues: new Float32Array(0),
    metric,
    filterStats: {
      totalVariants: 0,
      passedVariants: 0,
      filteredByMaf: 0,
      filteredByLength: 0,
      filteredByMultiallelic: 0,
      filteredByHwe: 0,
      filteredByCallRate: 0,
    },
    recombination: {
      values: new Float32Array(0),
      positions: [],
    },
  }
}

// Hardy-Weinberg equilibrium χ²(df=1) goodness-of-fit test. Returns false when
// the variant deviates beyond the critical value (i.e. should be filtered out).
function passesHweFilter(
  nHomRef: number,
  nHet: number,
  nHomAlt: number,
  nValid: number,
  chiSqCritical: number,
): boolean {
  const p = (2 * nHomRef + nHet) / (2 * nValid)
  const q = 1 - p
  const expectedHomRef = p * p * nValid
  const expectedHet = 2 * p * q * nValid
  const expectedHomAlt = q * q * nValid
  let chiSq = 0
  if (expectedHomRef > 0) {
    chiSq += (nHomRef - expectedHomRef) ** 2 / expectedHomRef
  }
  if (expectedHet > 0) {
    chiSq += (nHet - expectedHet) ** 2 / expectedHet
  }
  if (expectedHomAlt > 0) {
    chiSq += (nHomAlt - expectedHomAlt) ** 2 / expectedHomAlt
  }
  return chiSq <= chiSqCritical
}

// CPU fallback for the full pairwise lower-triangular LD matrix, used when the
// GPU path is unavailable.
function computeLDMatrixCPU(
  n: number,
  ldMetric: LDMetric,
  signedLD: boolean,
  dataIsPhased: boolean,
  packedHaplotypes: PackedHaplotypes[],
  encodedGenotypes: Int8Array[],
  stopTokenCheck: StopTokenChecker,
): Float32Array {
  const vals = new Float32Array((n * (n - 1)) / 2)
  let idx = 0
  for (let i = 1; i < n; i++) {
    for (let j = 0; j < i; j++) {
      const stats = dataIsPhased
        ? calculateLDStatsPhasedBits(
            packedHaplotypes[i]!,
            packedHaplotypes[j]!,
            signedLD,
          )
        : calculateLDStats(encodedGenotypes[i]!, encodedGenotypes[j]!, signedLD)
      vals[idx++] = ldMetric === 'dprime' ? stats.dprime : stats.r2
      checkStopToken2(stopTokenCheck)
    }
  }
  return vals
}

// Recombination evidence (1 - r²) between adjacent SNPs. When ldMetric is 'r2'
// the values already live in ldValues (lower-triangular pair (i+1, i) at index
// (i+1)*i/2 + i), so they're reused rather than recomputed.
function computeRecombination(
  snps: LDSnp[],
  ldValues: Float32Array,
  ldMetric: LDMetric,
  signedLD: boolean,
  dataIsPhased: boolean,
  packedHaplotypes: PackedHaplotypes[],
  encodedGenotypes: Int8Array[],
): RecombinationData {
  const n = snps.length
  const values = new Float32Array(Math.max(0, n - 1))
  const positions: number[] = []
  for (let i = 0; i < n - 1; i++) {
    let r2: number
    if (ldMetric === 'r2') {
      const v = ldValues[((i + 1) * i) / 2 + i]!
      r2 = signedLD ? v * v : v
    } else if (dataIsPhased) {
      r2 = calculateLDStatsPhasedBits(
        packedHaplotypes[i]!,
        packedHaplotypes[i + 1]!,
      ).r2
    } else {
      r2 = calculateLDStats(encodedGenotypes[i]!, encodedGenotypes[i + 1]!).r2
    }
    values[i] = 1 - r2
    positions.push((snps[i]!.start + snps[i + 1]!.start) / 2)
  }
  return { values, positions }
}

export async function getLDMatrix({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: {
    adapterConfig: AnyConfigurationModel
    stopToken?: StopToken
    sessionId: string
    headers?: Record<string, string>
    regions: Region[]
    bpPerPx: number
    minorAlleleFrequencyFilter: number
    lengthCutoffFilter: number
    hweFilterThreshold?: number
    callRateFilter?: number
    jexlFilters?: string[]
    ldMetric?: LDMetric
    signedLD?: boolean
    statusCallback?: (msg: string) => void
  }
}): Promise<LDMatrixResult> {
  const {
    minorAlleleFrequencyFilter,
    regions,
    adapterConfig,
    sessionId,
    lengthCutoffFilter,
    hweFilterThreshold = 0,
    callRateFilter = 0,
    jexlFilters = [],
    stopToken,
    ldMetric = 'r2',
    signedLD = false,
    statusCallback,
  } = args
  const stopTokenCheck = createStopTokenChecker(stopToken)
  const adapter = await getAdapter(pluginManager, sessionId, adapterConfig)
  const dataAdapter = adapter.dataAdapter as BaseFeatureDataAdapter

  // Get all samples from adapter
  const sources = await dataAdapter.getSources(regions)
  const samples = sources.map(s => s.name)

  if (samples.length === 0) {
    return emptyLDResult(ldMetric)
  }

  const splitCache: Record<string, string[]> = {}

  const rawFeatures = await updateStatus(
    'Loading features',
    statusCallback,
    () =>
      firstValueFrom(
        dataAdapter.getFeaturesInMultipleRegions(regions, args).pipe(toArray()),
      ),
  )
  const totalVariants = rawFeatures.length

  const snps: LDSnp[] = []
  const encodedGenotypes: Int8Array[] = []
  const packedHaplotypes: PackedHaplotypes[] = []
  let filteredByLength = 0
  let filteredByMaf = 0
  let filteredByMultiallelic = 0
  let filteredByHwe = 0
  let filteredByCallRate = 0

  const callRateFilterEnabled = callRateFilter > 0
  const chiSqCritical = getChiSquareCritical(hweFilterThreshold)
  const hweFilterEnabled = hweFilterThreshold > 0
  const filterChain =
    jexlFilters.length > 0
      ? new SerializableFilterChain({ filters: jexlFilters })
      : null

  let dataIsPhased = false
  if (rawFeatures.length > 0) {
    const first = rawFeatures[0]!
    const rawGt = getRawCallGenotype(first)
    if (rawGt) {
      dataIsPhased = isPhasedRaw(first)
    } else {
      const firstGenotypes = first.get('genotypes') as Record<string, string>
      dataIsPhased = isPhased(firstGenotypes)
    }
  }

  const nSamples = samples.length
  // Pre-allocate a flat buffer for all encoded genotypes to avoid per-variant
  // Int8Array allocation. Variants that fail filters reuse the same slot
  // (snpIdx is only incremented when a variant passes all filters).
  const encodedFlat = dataIsPhased
    ? null
    : new Int8Array(totalVariants * nSamples)
  let snpIdx = 0

  for (const feature of rawFeatures) {
    if (feature.get('end') - feature.get('start') > lengthCutoffFilter) {
      filteredByLength++
      continue
    }

    if (filterChain && !filterChain.passes(feature, undefined, undefined)) {
      continue
    }

    const alt = feature.get('ALT') as string[] | undefined
    if (alt && alt.length > 1) {
      filteredByMultiallelic++
      continue
    }

    const rawGt = getRawCallGenotype(feature)
    const ploidy = feature.get('ploidy') as number
    const genotypes = rawGt
      ? undefined
      : (feature.get('genotypes') as Record<string, string>)

    let packed:
      | ReturnType<typeof packHaplotypesFromRaw>
      | ReturnType<typeof packHaplotypesWithCounts>
      | undefined
    let encodedSlot: Int8Array | undefined
    let nHomRef: number
    let nHet: number
    let nHomAlt: number
    let nValid: number

    if (dataIsPhased) {
      packed = rawGt
        ? packHaplotypesFromRaw(
            rawGt,
            feature.get('callGenotypePhased') as Uint8Array | undefined,
            ploidy,
            nSamples,
          )
        : packHaplotypesWithCounts(genotypes!, samples)
      ;({ nHomRef, nHet, nHomAlt, nValid } = packed)
    } else {
      encodedSlot = encodedFlat!.subarray(
        snpIdx * nSamples,
        (snpIdx + 1) * nSamples,
      )
      ;({ nHomRef, nHet, nHomAlt, nValid } = rawGt
        ? fillEncodedFromRaw(encodedSlot, rawGt, ploidy, nSamples)
        : fillEncoded(encodedSlot, genotypes!, samples, splitCache))
    }

    const altFreq = nValid > 0 ? (nHet + 2 * nHomAlt) / (2 * nValid) : 0
    if (Math.min(altFreq, 1 - altFreq) < minorAlleleFrequencyFilter) {
      filteredByMaf++
      continue
    }

    if (callRateFilterEnabled && nValid / nSamples < callRateFilter) {
      filteredByCallRate++
      continue
    }

    if (
      hweFilterEnabled &&
      nValid > 0 &&
      !passesHweFilter(nHomRef, nHet, nHomAlt, nValid, chiSqCritical)
    ) {
      filteredByHwe++
      continue
    }

    snps.push({
      id: feature.get('name') || feature.id(),
      refName: feature.get('refName'),
      start: feature.get('start'),
      end: feature.get('end'),
    })

    if (packed) {
      packedHaplotypes.push(packed)
    } else {
      encodedGenotypes.push(encodedSlot!)
      snpIdx++
    }

    checkStopToken2(stopTokenCheck)
  }

  const n = snps.length

  let ldValues: Float32Array | null = null
  try {
    ldValues = await updateStatus('Computing LD values', statusCallback, () =>
      dataIsPhased
        ? computeLDMatrixGPUPhased(packedHaplotypes, ldMetric, signedLD)
        : computeLDMatrixGPU(encodedGenotypes, ldMetric, signedLD),
    )
  } catch (e) {
    console.warn('GPU LD computation failed, falling back to CPU', e)
  }

  ldValues ??= await updateStatus('Computing LD values', statusCallback, () =>
    computeLDMatrixCPU(
      n,
      ldMetric,
      signedLD,
      dataIsPhased,
      packedHaplotypes,
      encodedGenotypes,
      stopTokenCheck,
    ),
  )

  const filterStats: FilterStats = {
    totalVariants,
    passedVariants: snps.length,
    filteredByMaf,
    filteredByLength,
    filteredByMultiallelic,
    filteredByHwe,
    filteredByCallRate,
  }

  const recombination = computeRecombination(
    snps,
    ldValues,
    ldMetric,
    signedLD,
    dataIsPhased,
    packedHaplotypes,
    encodedGenotypes,
  )

  return { snps, ldValues, metric: ldMetric, filterStats, recombination }
}
