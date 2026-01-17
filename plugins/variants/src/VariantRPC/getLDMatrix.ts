import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { firstValueFrom, toArray } from 'rxjs'

import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../shared/minorAlleleFrequencyUtils.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type PluginManager from '@jbrowse/core/PluginManager'
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
  for (let i = 0; i < samples.length; i++) {
    const val = genotypes[samples[i]!]!
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

  return { r2, dprime }
}

export interface LDMatrixResult {
  snps: Array<{
    id: string
    refName: string
    start: number
    end: number
  }>
  // Lower triangular matrix stored as flat array
  // For n SNPs: [ld(1,0), ld(2,0), ld(2,1), ld(3,0), ...]
  ldValues: Float32Array
  // Which metric was computed
  metric: LDMetric
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
    ldMetric?: LDMetric
  }
}): Promise<LDMatrixResult> {
  const {
    minorAlleleFrequencyFilter,
    regions,
    adapterConfig,
    sessionId,
    lengthCutoffFilter,
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
    return { snps: [], ldValues: new Float32Array(0), metric: ldMetric }
  }

  const splitCache = {} as Record<string, string[]>

  // Get features that pass MAF filter
  const filteredFeatures = getFeaturesThatPassMinorAlleleFrequencyFilter({
    minorAlleleFrequencyFilter,
    lengthCutoffFilter,
    lastCheck,
    splitCache,
    features: await firstValueFrom(
      dataAdapter.getFeaturesInMultipleRegions(regions, args).pipe(toArray()),
    ),
  })

  // Extract SNP info and encode genotypes
  const snps: LDMatrixResult['snps'] = []
  const encodedGenotypes: Int8Array[] = []

  for (const { feature } of filteredFeatures) {
    snps.push({
      id: feature.get('name') || feature.id(),
      refName: feature.get('refName'),
      start: feature.get('start'),
      end: feature.get('end'),
    })

    const genotypes = feature.get('genotypes') as Record<string, string>
    encodedGenotypes.push(encodeGenotypes(genotypes, samples, splitCache))

    checkStopToken2(lastCheck)
  }

  // Calculate LD matrix (lower triangular, excluding diagonal)
  const n = snps.length
  const ldSize = (n * (n - 1)) / 2
  const ldValues = new Float32Array(ldSize)

  let idx = 0
  for (let i = 1; i < n; i++) {
    for (let j = 0; j < i; j++) {
      const stats = calculateLDStats(encodedGenotypes[i]!, encodedGenotypes[j]!)
      ldValues[idx++] = ldMetric === 'dprime' ? stats.dprime : stats.r2
    }
    checkStopToken2(lastCheck)
  }

  return { snps, ldValues, metric: ldMetric }
}
