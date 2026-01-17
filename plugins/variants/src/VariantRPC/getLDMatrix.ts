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

/**
 * Calculate R² between two SNPs using genotype data
 * Uses composite LD (genotype correlation) approach
 * Based on Rogers and Huff (2009) method
 */
function calculateR2(geno1: Int8Array, geno2: Int8Array): number {
  let n = 0
  // Genotype pair counts [geno1][geno2] for geno1,geno2 in {0,1,2}
  const counts = new Float64Array(9)

  for (let i = 0; i < geno1.length; i++) {
    const g1 = geno1[i]!
    const g2 = geno2[i]!
    if (g1 >= 0 && g2 >= 0) {
      counts[g1 * 3 + g2]++
      n++
    }
  }

  if (n < 3) {
    return 0
  }

  // Calculate sums for allele frequencies
  let sumG1 = 0
  let sumG2 = 0
  let sumProd = 0
  for (let g1 = 0; g1 < 3; g1++) {
    for (let g2 = 0; g2 < 3; g2++) {
      const c = counts[g1 * 3 + g2]!
      sumG1 += g1 * c
      sumG2 += g2 * c
      sumProd += g1 * g2 * c
    }
  }

  const p1 = sumG1 / (2 * n)
  const p2 = sumG2 / (2 * n)

  // Handle edge cases where allele is fixed
  if (p1 <= 0 || p1 >= 1 || p2 <= 0 || p2 >= 1) {
    return 0
  }

  // Genotype covariance
  const covG = sumProd / n - (sumG1 / n) * (sumG2 / n)

  // Variance of genotype = 2*p*(1-p) for HWE
  const var1 = 2 * p1 * (1 - p1)
  const var2 = 2 * p2 * (1 - p2)

  if (var1 <= 0 || var2 <= 0) {
    return 0
  }

  // Composite LD r²
  const r2 = (covG * covG) / (var1 * var2)
  return Math.min(1, Math.max(0, r2))
}

export interface LDMatrixResult {
  snps: Array<{
    id: string
    refName: string
    start: number
    end: number
  }>
  // Lower triangular matrix stored as flat array
  // For n SNPs: [r2(1,0), r2(2,0), r2(2,1), r2(3,0), ...]
  ldValues: Float32Array
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
  }
}): Promise<LDMatrixResult> {
  const {
    minorAlleleFrequencyFilter,
    regions,
    adapterConfig,
    sessionId,
    lengthCutoffFilter,
    stopToken,
  } = args

  const lastCheck = createStopTokenChecker(stopToken)
  const adapter = await getAdapter(pluginManager, sessionId, adapterConfig)
  const dataAdapter = adapter.dataAdapter as BaseFeatureDataAdapter

  // Get all samples from adapter
  const sources = await dataAdapter.getSources?.()
  const samples = sources?.map(s => s.name) ?? []

  if (samples.length === 0) {
    return { snps: [], ldValues: new Float32Array(0) }
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
      ldValues[idx++] = calculateR2(encodedGenotypes[i]!, encodedGenotypes[j]!)
    }
    checkStopToken2(lastCheck)
  }

  return { snps, ldValues }
}
