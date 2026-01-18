import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { firstValueFrom, toArray } from 'rxjs'

import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../shared/minorAlleleFrequencyUtils.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

const SPLITTER = /[/|]/

/**
 * Check if genotypes are phased (use | separator)
 */
function isPhased(genotypes: Record<string, string>): boolean {
  const firstVal = Object.values(genotypes)[0]
  return firstVal?.includes('|') ?? false
}

/**
 * Encode genotypes for all samples as a single Int8Array
 * Values: 0=hom ref, 1=het, 2=hom alt, -1=missing
 */
function encodeGenotypes(
  genotypes: Record<string, string>,
  samples: string[],
  splitCache: Record<string, string[]>,
): Int8Array {
  const encoded = new Int8Array(samples.length)
  for (const [i, sample] of samples.entries()) {
    const val = genotypes[sample]!
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
      encoded[i] = -1
    } else if (nonRefCount === 0) {
      encoded[i] = 0
    } else if (nonRefCount === alleles.length) {
      encoded[i] = 2
    } else {
      encoded[i] = 1
    }
  }
  return encoded
}

/**
 * Encode phased genotypes as haplotype pairs for all samples
 * Returns two Int8Arrays: one for each chromosome
 * Values: 0=ref, 1=alt, -1=missing
 */
function encodePhasedHaplotypes(
  genotypes: Record<string, string>,
  samples: string[],
): { hap1: Int8Array; hap2: Int8Array } {
  const hap1 = new Int8Array(samples.length)
  const hap2 = new Int8Array(samples.length)

  for (const [i, sample] of samples.entries()) {
    const val = genotypes[sample]!
    const alleles = val.split('|')

    if (alleles.length !== 2) {
      // Not properly phased diploid, mark as missing
      hap1[i] = -1
      hap2[i] = -1
      continue
    }

    // Chromosome 1
    if (alleles[0] === '.') {
      hap1[i] = -1
    } else {
      hap1[i] = alleles[0] === '0' ? 0 : 1
    }

    // Chromosome 2
    if (alleles[1] === '.') {
      hap2[i] = -1
    } else {
      hap2[i] = alleles[1] === '0' ? 0 : 1
    }
  }

  return { hap1, hap2 }
}

/**
 * Calculate LD statistics from phased haplotype data
 * This gives exact values since we know the phase
 */
function calculateLDStatsPhased(
  haps1: { hap1: Int8Array; hap2: Int8Array },
  haps2: { hap1: Int8Array; hap2: Int8Array },
): {
  r2: number
  dprime: number
} {
  // Count haplotype frequencies directly
  // Haplotypes: 00 (ref-ref), 01 (ref-alt), 10 (alt-ref), 11 (alt-alt)
  let n01 = 0 // ref at locus 1, alt at locus 2
  let n10 = 0 // alt at locus 1, ref at locus 2
  let n11 = 0 // alt at locus 1, alt at locus 2
  let total = 0

  const numSamples = haps1.hap1.length

  // Count haplotypes from chromosome 1 of each sample
  for (let i = 0; i < numSamples; i++) {
    const a1 = haps1.hap1[i]! // allele at locus 1, chrom 1
    const b1 = haps2.hap1[i]! // allele at locus 2, chrom 1

    if (a1 >= 0 && b1 >= 0) {
      if (a1 === 0 && b1 === 1) {
        n01++
      } else if (a1 === 1 && b1 === 0) {
        n10++
      } else if (a1 === 1 && b1 === 1) {
        n11++
      }
      total++
    }
  }

  // Count haplotypes from chromosome 2 of each sample
  for (let i = 0; i < numSamples; i++) {
    const a2 = haps1.hap2[i]! // allele at locus 1, chrom 2
    const b2 = haps2.hap2[i]! // allele at locus 2, chrom 2

    if (a2 >= 0 && b2 >= 0) {
      if (a2 === 0 && b2 === 1) {
        n01++
      } else if (a2 === 1 && b2 === 0) {
        n10++
      } else if (a2 === 1 && b2 === 1) {
        n11++
      }
      total++
    }
  }

  if (total < 4) {
    // Need at least 4 haplotypes (2 diploid individuals)
    return { r2: 0, dprime: 0 }
  }

  // Haplotype frequencies
  const p01 = n01 / total // freq of ref-alt haplotype
  const p10 = n10 / total // freq of alt-ref haplotype
  const p11 = n11 / total // freq of alt-alt haplotype

  // Allele frequencies
  const pA = p10 + p11 // freq of alt at locus 1
  const pB = p01 + p11 // freq of alt at locus 2
  const qA = 1 - pA
  const qB = 1 - pB

  // Check for monomorphic loci
  if (pA <= 0 || pA >= 1 || pB <= 0 || pB >= 1) {
    return { r2: 0, dprime: 0 }
  }

  // D = P(AB) - P(A)*P(B) where AB means alt-alt haplotype
  const D = p11 - pA * pB

  // r² = D² / (pA * qA * pB * qB)
  const r2 = Math.min(1, Math.max(0, (D * D) / (pA * qA * pB * qB)))

  // D' = |D| / Dmax
  let dprime = 0
  if (D > 0) {
    const Dmax = Math.min(pA * qB, qA * pB)
    if (Dmax > 0) {
      dprime = Math.min(1, D / Dmax)
    }
  } else if (D < 0) {
    const Dmin = -Math.min(pA * pB, qA * qB)
    if (Dmin < 0) {
      dprime = Math.min(1, Math.abs(D / Dmin))
    }
  }

  return { r2, dprime }
}

export type LDMetric = 'r2' | 'dprime'

/**
 * Calculate LD statistics from genotype counts
 * Returns both R² and D' so caller can choose which to use
 */
function calculateLDStats(
  geno1: Int8Array,
  geno2: Int8Array,
  _debugInfo?: { snp1Id: string; snp2Id: string },
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

  // Count genotype combinations for debugging
  const genoCounts: Record<string, number> = {}

  // Count haplotype frequencies from genotype data
  // For unphased diploid data, we estimate haplotype frequencies
  // using the composite approach
  //
  // Genotype encoding: 0=AA, 1=Aa, 2=aa (where A=ref, a=alt)
  // We count allele dosages and estimate haplotype freqs

  for (const [i, element] of geno1.entries()) {
    const g1 = element
    const g2 = geno2[i]!
    // Only include samples where both genotypes are called
    if (g1 >= 0 && g2 >= 0) {
      n++
      sumG1 += g1
      sumG2 += g2
      sumG1sq += g1 * g1
      sumG2sq += g2 * g2
      sumProd += g1 * g2

      // Track genotype combinations
      const key = `${g1},${g2}`
      genoCounts[key] = (genoCounts[key] || 0) + 1
    }
  }

  // Need at least 2 samples
  if (n < 2) {
    return { r2: 0, dprime: 0 }
  }

  // Allele frequencies (frequency of alt allele)
  const pA = sumG1 / (2 * n) // freq of alt at locus 1
  const pB = sumG2 / (2 * n) // freq of alt at locus 2
  const qA = 1 - pA // freq of ref at locus 1
  const qB = 1 - pB // freq of ref at locus 2

  // If either locus is monomorphic, LD is undefined
  if (pA <= 0 || pA >= 1 || pB <= 0 || pB >= 1) {
    return { r2: 0, dprime: 0 }
  }

  // === R² calculation (PLINK style) ===
  // Squared Pearson correlation of genotype dosages
  const mean1 = sumG1 / n
  const mean2 = sumG2 / n
  const var1 = sumG1sq / n - mean1 * mean1
  const var2 = sumG2sq / n - mean2 * mean2

  let r2 = 0
  if (var1 > 0 && var2 > 0) {
    const cov = sumProd / n - mean1 * mean2
    r2 = (cov * cov) / (var1 * var2)
    r2 = Math.min(1, Math.max(0, r2))
  }

  // === D' calculation ===
  // D = P(AB) - P(A)*P(B)
  // For unphased data, estimate D from genotype covariance
  //
  // Under Hardy-Weinberg equilibrium: Cov(g1, g2) = 2D
  // So D = Cov(g1, g2) / 2
  // This is the composite LD estimator (Weir 1979)
  const covG = sumProd / n - mean1 * mean2
  const D = covG / 2

  // D' = D / Dmax
  // Dmax depends on sign of D:
  // If D > 0: Dmax = min(pA*qB, qA*pB)
  // If D < 0: Dmax = min(pA*pB, qA*qB)
  let dprime = 0
  if (D > 0) {
    const Dmax = Math.min(pA * qB, qA * pB)
    if (Dmax > 0) {
      dprime = Math.min(1, D / Dmax)
    }
  } else if (D < 0) {
    const Dmin = -Math.min(pA * pB, qA * qB)
    if (Dmin < 0) {
      dprime = Math.min(1, Math.abs(D / Dmin))
    }
  }

  return { r2, dprime }
}

export interface FilterStats {
  totalVariants: number
  passedVariants: number
  filteredByMaf: number
  filteredByLength: number
  filteredByMultiallelic: number
  filteredByHwe: number
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
  // Lower triangular matrix stored as flat array
  // For n SNPs: [ld(1,0), ld(2,0), ld(2,1), ld(3,0), ...]
  ldValues: Float32Array
  // Which metric was computed
  metric: LDMetric
  // Statistics about filtered variants
  filterStats: FilterStats
  // Recombination rate estimates between adjacent SNPs
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
    ldMetric?: LDMetric
  }
}): Promise<LDMatrixResult> {
  const {
    minorAlleleFrequencyFilter,
    regions,
    adapterConfig,
    sessionId,
    lengthCutoffFilter,
    hweFilterThreshold = 0.001,
    stopToken,
    ldMetric = 'r2',
  } = args

  const lastCheck = createStopTokenChecker(stopToken)
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
      },
      recombination: {
        values: new Float32Array(0),
        positions: [],
      },
    }
  }

  const splitCache = {} as Record<string, string[]>

  // Get all raw features first to count total
  const rawFeatures = await firstValueFrom(
    dataAdapter.getFeaturesInMultipleRegions(regions, args).pipe(toArray()),
  )
  const totalVariants = rawFeatures.length

  // Get features that pass MAF and length filters
  const filteredFeatures = getFeaturesThatPassMinorAlleleFrequencyFilter({
    minorAlleleFrequencyFilter,
    lengthCutoffFilter,
    lastCheck,
    splitCache,
    features: rawFeatures,
  })

  // Count how many were filtered by length vs MAF
  // We need to count separately
  let filteredByLength = 0
  let filteredByMaf = 0
  for (const feature of rawFeatures) {
    if (feature.get('end') - feature.get('start') > lengthCutoffFilter) {
      filteredByLength++
    } else {
      // Check if it was filtered by MAF
      const featureId = feature.id()
      const wasPassed = filteredFeatures.some(f => f.feature.id() === featureId)
      if (!wasPassed) {
        filteredByMaf++
      }
    }
  }

  // Extract SNP info and encode genotypes
  // Like Haploview, we only include biallelic sites
  const snps: LDMatrixResult['snps'] = []
  const encodedGenotypes: Int8Array[] = []
  const phasedHaplotypes: { hap1: Int8Array; hap2: Int8Array }[] = []
  let filteredByMultiallelic = 0
  let filteredByHwe = 0

  // Detect if data is phased by checking first feature
  let dataIsPhased = false
  if (filteredFeatures.length > 0) {
    const firstGenotypes = filteredFeatures[0]!.feature.get(
      'genotypes',
    ) as Record<string, string>
    dataIsPhased = isPhased(firstGenotypes)
  }

  // Chi-square critical values for common p-value thresholds (df=1)
  // Use lookup table for common values, approximate for others
  const getChiSquareCritical = (pValue: number): number => {
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
    // Approximation using inverse chi-square for df=1
    // chi-sq ≈ -2 * ln(p) is rough; use better approximation
    // For df=1, P(χ² > x) = 2*(1 - Φ(√x)) where Φ is normal CDF
    // So x = (Φ⁻¹(1 - p/2))²
    // Use approximation: for small p, x ≈ -2*ln(p)
    return -2 * Math.log(pValue)
  }

  const chiSqCritical = getChiSquareCritical(hweFilterThreshold)
  const hweFilterEnabled = hweFilterThreshold > 0

  for (const { feature } of filteredFeatures) {
    // Skip multiallelic sites (Haploview only works with biallelic SNPs)
    const alt = feature.get('ALT') as string[] | undefined
    if (alt && alt.length > 1) {
      filteredByMultiallelic++
      continue
    }

    const genotypes = feature.get('genotypes') as Record<string, string>
    const encoded = encodeGenotypes(genotypes, samples, splitCache)

    // Check for Hardy-Weinberg equilibrium (like Haploview's HWE filter)
    // Count genotypes: 0=hom ref, 1=het, 2=hom alt
    if (hweFilterEnabled) {
      let nHomRef = 0
      let nHet = 0
      let nHomAlt = 0
      let nValid = 0
      for (const g of encoded) {
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

      // Calculate HWE chi-square test
      // Under HWE: p² + 2pq + q² = 1
      if (nValid > 0) {
        const p = (2 * nHomRef + nHet) / (2 * nValid) // ref allele freq
        const q = 1 - p // alt allele freq
        const expectedHomRef = p * p * nValid
        const expectedHet = 2 * p * q * nValid
        const expectedHomAlt = q * q * nValid

        // Chi-square statistic
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
    }

    snps.push({
      id: feature.get('name') || feature.id(),
      refName: feature.get('refName'),
      start: feature.get('start'),
      end: feature.get('end'),
    })

    // Store both unphased genotypes (for HWE check) and phased haplotypes (if available)
    encodedGenotypes.push(encoded)
    if (dataIsPhased) {
      phasedHaplotypes.push(encodePhasedHaplotypes(genotypes, samples))
    }

    checkStopToken2(lastCheck)
  }

  // Calculate LD matrix (lower triangular, excluding diagonal)
  const n = snps.length
  const ldSize = (n * (n - 1)) / 2
  const ldValues = new Float32Array(ldSize)

  let idx = 0
  for (let i = 1; i < n; i++) {
    for (let j = 0; j < i; j++) {
      // Use exact haplotype-based calculation for phased data or
      // use composite LD estimator for unphased data
      const stats = dataIsPhased
        ? calculateLDStatsPhased(phasedHaplotypes[i]!, phasedHaplotypes[j]!)
        : calculateLDStats(encodedGenotypes[i]!, encodedGenotypes[j]!, {
            snp1Id: snps[i]!.id,
            snp2Id: snps[j]!.id,
          })

      ldValues[idx++] = ldMetric === 'dprime' ? stats.dprime : stats.r2
    }
    checkStopToken2(lastCheck)
  }

  const filterStats: FilterStats = {
    totalVariants,
    passedVariants: snps.length,
    filteredByMaf,
    filteredByLength,
    filteredByMultiallelic,
    filteredByHwe,
  }

  // Calculate recombination rate estimates between adjacent SNPs
  // Using 1 - r² as a proxy for recombination (LD decay)
  const recombValues = new Float32Array(Math.max(0, n - 1))
  const recombPositions: number[] = []

  for (let i = 0; i < n - 1; i++) {
    let r2: number

    if (dataIsPhased) {
      const stats = calculateLDStatsPhased(
        phasedHaplotypes[i]!,
        phasedHaplotypes[i + 1]!,
      )
      r2 = stats.r2
    } else {
      const stats = calculateLDStats(
        encodedGenotypes[i]!,
        encodedGenotypes[i + 1]!,
      )
      r2 = stats.r2
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
