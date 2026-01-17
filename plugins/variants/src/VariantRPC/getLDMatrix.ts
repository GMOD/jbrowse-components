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
import type { Feature, Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

const SPLITTER = /[/|]/

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

export type LDMetric = 'r2' | 'dprime'

/**
 * Calculate LD statistics from genotype counts
 * Returns both R² and D' so caller can choose which to use
 */
function calculateLDStats(
  geno1: Int8Array,
  geno2: Int8Array,
  debugInfo?: { snp1Id: string; snp2Id: string },
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
  // For unphased data, estimate P(AB) from genotype correlation
  //
  // Using composite LD: D ≈ cov(g1,g2) / 4
  // (since genotypes are 0,1,2 and we want haplotype-level D)
  const covG = sumProd / n - mean1 * mean2
  const D = covG / 4 // Scale from genotype to haplotype level

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

  // Debug logging for low R² values
  if (r2 < 0.1 && debugInfo) {
    console.log('=== Low R² Debug ===')
    console.log(`SNPs: ${debugInfo.snp1Id} x ${debugInfo.snp2Id}`)
    console.log(`R² = ${r2.toFixed(4)}, D' = ${dprime.toFixed(4)}`)
    console.log(`n samples: ${n}`)
    console.log(`Allele freqs: pA=${pA.toFixed(3)}, pB=${pB.toFixed(3)}`)
    console.log(`MAF1=${Math.min(pA, qA).toFixed(3)}, MAF2=${Math.min(pB, qB).toFixed(3)}`)
    console.log(`Genotype counts (g1,g2): ${JSON.stringify(genoCounts)}`)
    console.log(`Variance: var1=${var1.toFixed(4)}, var2=${var2.toFixed(4)}`)
    console.log(`Covariance: ${covG.toFixed(4)}`)
    console.log('====================')
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
  const sources = await dataAdapter.getSources?.(regions)
  const samples = sources?.map(s => s.name) ?? []

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
  let filteredByMultiallelic = 0
  let filteredByHwe = 0

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
          chiSq += ((nHomRef - expectedHomRef) ** 2) / expectedHomRef
        }
        if (expectedHet > 0) {
          chiSq += ((nHet - expectedHet) ** 2) / expectedHet
        }
        if (expectedHomAlt > 0) {
          chiSq += ((nHomAlt - expectedHomAlt) ** 2) / expectedHomAlt
        }

        if (chiSq > chiSqCritical) {
          console.log(
            `Excluding ${feature.get('name') || feature.id()} - HWE violation (χ²=${chiSq.toFixed(2)} > ${chiSqCritical.toFixed(2)}), ` +
              `observed: ${nHomRef}/${nHet}/${nHomAlt}, ` +
              `expected: ${expectedHomRef.toFixed(0)}/${expectedHet.toFixed(0)}/${expectedHomAlt.toFixed(0)}`,
          )
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
    encodedGenotypes.push(encoded)

    checkStopToken2(lastCheck)
  }

  // Calculate LD matrix (lower triangular, excluding diagonal)
  const n = snps.length
  const ldSize = (n * (n - 1)) / 2
  const ldValues = new Float32Array(ldSize)

  let idx = 0
  for (let i = 1; i < n; i++) {
    for (let j = 0; j < i; j++) {
      const stats = calculateLDStats(encodedGenotypes[i]!, encodedGenotypes[j]!, {
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

  return { snps, ldValues, metric: ldMetric, filterStats }
}
