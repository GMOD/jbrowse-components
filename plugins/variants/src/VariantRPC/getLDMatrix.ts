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
import type { StopToken } from '@jbrowse/core/util/stopToken'
const SLASH_CODE = 47 // '/'
const PIPE_CODE = 124 // '|'
const ZERO_CODE = 48 // '0'
const DOT_CODE = 46 // '.'

function isPhased(genotypes: Record<string, string>): boolean {
  const firstVal = Object.values(genotypes)[0]
  return firstVal?.includes('|') ?? false
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
        // Fast path: both alleles called, no missing/padding
        const isAlt0 = a0 !== 0
        const isAlt1 = a1 !== 0
        if (!isAlt0 && !isAlt1) {
          out[s] = 0
          nHomRef++
          nValid++
        } else if (isAlt0 && isAlt1) {
          out[s] = 2
          nHomAlt++
          nValid++
        } else {
          out[s] = 1
          nHet++
          nValid++
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

function packHaplotypesFromRaw(
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

  if (ploidy === 2) {
    // Diploid fast path: hoist ploidy=2 constant, use s<<1 offset.
    // A single loop handles both phased and unphased — V8 hoists the
    // `callGenotypePhased &&` null-check, which is faster than splitting into
    // two separate loops (benchmark showed the split added overhead).
    for (let s = 0; s < nSamples; s++) {
      if (callGenotypePhased && !callGenotypePhased[s]) {
        continue
      }
      const off = s << 1
      const a0 = callGenotype[off]!
      const a1 = callGenotype[off + 1]!
      if (a0 === -2 || a1 === -2) {
        continue
      }
      const w = s >>> 5
      const bit = 1 << (s & 31)
      const v0 = a0 !== -1
      const v1 = a1 !== -1
      if (v0) {
        validH1[w] = validH1[w]! | bit
        if (a0 !== 0) {
          altH1[w] = altH1[w]! | bit
        }
      }
      if (v1) {
        validH2[w] = validH2[w]! | bit
        if (a1 !== 0) {
          altH2[w] = altH2[w]! | bit
        }
      }
      if (v0 && v1) {
        nValid++
        const isAlt0 = a0 !== 0
        const isAlt1 = a1 !== 0
        if (!isAlt0 && !isAlt1) {
          nHomRef++
        } else if (isAlt0 && isAlt1) {
          nHomAlt++
        } else {
          nHet++
        }
      }
    }
  } else {
    for (let s = 0; s < nSamples; s++) {
      if (callGenotypePhased && !callGenotypePhased[s]) {
        continue
      }
      const a0 = callGenotype[s * ploidy]!
      const a1 = ploidy > 1 ? callGenotype[s * ploidy + 1]! : -2
      if (a0 === -2 || a1 === -2) {
        continue
      }
      const w = s >>> 5
      const bit = 1 << (s & 31)
      const v0 = a0 !== -1
      const v1 = a1 !== -1
      if (v0) {
        validH1[w] = validH1[w]! | bit
        if (a0 !== 0) {
          altH1[w] = altH1[w]! | bit
        }
      }
      if (v1) {
        validH2[w] = validH2[w]! | bit
        if (a1 !== 0) {
          altH2[w] = altH2[w]! | bit
        }
      }
      if (v0 && v1) {
        nValid++
        const isAlt0 = a0 !== 0
        const isAlt1 = a1 !== 0
        if (!isAlt0 && !isAlt1) {
          nHomRef++
        } else if (isAlt0 && isAlt1) {
          nHomAlt++
        } else {
          nHet++
        }
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

/**
 * Chi-square critical values for common p-value thresholds (df=1)
 * Use lookup table for common values, approximate for others
 */
function getChiSquareCritical(pValue: number): number {
  if (pValue <= 0) {
    return Number.POSITIVE_INFINITY // Disable filter
  }
  if (pValue >= 1) {
    return 0
  }
  // Common lookup values
  if (pValue === 0.05) {
    return 3.841
  }
  if (pValue === 0.01) {
    return 6.635
  }
  if (pValue === 0.001) {
    return 10.828
  }
  if (pValue === 0.0001) {
    return 15.137
  }
  // Approximation: for small p, x ≈ -2*ln(p)
  return -2 * Math.log(pValue)
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

export interface LDMatrixResult {
  snps: {
    id: string
    refName: string
    start: number
    end: number
  }[]
  ldValues: Float32Array
  metric: LDMetric
  filterStats: FilterStats
  recombination: RecombinationData
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
    return {
      snps: [],
      ldValues: new Float32Array(0),
      metric: ldMetric,
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

  const splitCache = {} as Record<string, string[]>

  const rawFeatures = await updateStatus(
    'Loading features',
    statusCallback,
    () =>
      firstValueFrom(
        dataAdapter.getFeaturesInMultipleRegions(regions, args).pipe(toArray()),
      ),
  )
  const totalVariants = rawFeatures.length

  const snps: LDMatrixResult['snps'] = []
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
  const encodedFlat = dataIsPhased ? null : new Int8Array(totalVariants * nSamples)
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
    let nHomRef = 0
    let nHet = 0
    let nHomAlt = 0
    let nValid = 0

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
      encodedSlot = encodedFlat!.subarray(snpIdx * nSamples, (snpIdx + 1) * nSamples)
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

    if (hweFilterEnabled && nValid > 0) {
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
      if (chiSq > chiSqCritical) {
        filteredByHwe++
        continue
      }
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

  const ldSize = (n * (n - 1)) / 2

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

  if (!ldValues) {
    ldValues = await updateStatus('Computing LD values', statusCallback, () => {
      const vals = new Float32Array(ldSize)
      let idx = 0
      for (let i = 1; i < n; i++) {
        for (let j = 0; j < i; j++) {
          const stats = dataIsPhased
            ? calculateLDStatsPhasedBits(
                packedHaplotypes[i]!,
                packedHaplotypes[j]!,
                signedLD,
              )
            : calculateLDStats(
                encodedGenotypes[i]!,
                encodedGenotypes[j]!,
                signedLD,
              )
          vals[idx++] = ldMetric === 'dprime' ? stats.dprime : stats.r2
          checkStopToken2(stopTokenCheck)
        }
      }
      return vals
    })
  }

  const filterStats: FilterStats = {
    totalVariants,
    passedVariants: snps.length,
    filteredByMaf,
    filteredByLength,
    filteredByMultiallelic,
    filteredByHwe,
    filteredByCallRate,
  }

  // Calculate recombination rate estimates between adjacent SNPs
  // Using 1 - r² as a proxy for recombination (LD decay)
  const recombValues = new Float32Array(Math.max(0, n - 1))
  const recombPositions: number[] = []

  for (let i = 0; i < n - 1; i++) {
    let r2: number

    // When ldMetric is 'r2', ldValues already holds r² for every pair in
    // lower-triangular order: index of pair (i+1, i) = (i+1)*i/2 + i.
    // Reuse those values rather than recomputing.
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

    // 1 - r² gives recombination evidence (higher = more recombination)
    recombValues[i] = 1 - r2

    // Position is midpoint between the two SNPs
    const pos1 = snps[i]!.start
    const pos2 = snps[i + 1]!.start
    recombPositions.push((pos1 + pos2) / 2)
  }

  const recombination: RecombinationData = {
    values: recombValues,
    positions: recombPositions,
  }

  return { snps, ldValues, metric: ldMetric, filterStats, recombination }
}
