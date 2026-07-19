import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { createProgressReporter, updateStatus } from '@jbrowse/core/util'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import {
  calculateLDStats,
  calculateLDStatsPhasedBits,
  packHaplotypesWithCounts,
} from '@jbrowse/ld-core'

import {
  computeLDMatrixGPU,
  computeLDMatrixGPUPhased,
} from './getLDMatrixGPU.ts'
import { GENOTYPE_SPLITTER as SPLITTER } from '../shared/constants.ts'
import { phaseSignal } from '../shared/detectPhased.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { StopToken, StopTokenChecker } from '@jbrowse/core/util/stopToken'
import type { PackedHaplotypes } from '@jbrowse/ld-core'
const SLASH_CODE = 47 // '/'
const PIPE_CODE = 124 // '|'
const ZERO_CODE = 48 // '0'
const DOT_CODE = 46 // '.'

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

export type LDMetric = 'r2' | 'dprime'

/**
 * How the displayed LD values were derived, so the UI can be honest about
 * precision: 'phased' is exact haplotypic LD, 'composite' is the Weir composite
 * estimate from unphased genotype dosages, 'precomputed' is read from a file.
 */
export type LDMethod = 'phased' | 'composite' | 'precomputed'

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
  // The VCF ID column (e.g. an rsID), absent when the file has none ('.').
  // Never falls back to feature.id(), which is a synthetic adapter-internal
  // string, not an identifier a user would recognize.
  id?: string
  refName: string
  start: number
  end: number
  // Minor allele frequency (0-0.5). Absent for pre-computed LD adapters
  // (PLINK/ldmat) where genotypes aren't available to compute it.
  maf?: number
}

export interface LDMatrixResult {
  snps: LDSnp[]
  ldValues: Float32Array
  // The metric actually represented by ldValues. Usually equals the requested
  // metric, but a pre-computed file lacking a D' column downgrades a 'dprime'
  // request to 'r2' rather than silently mislabeling r² as D'.
  metric: LDMetric
  // Whether D' is available. Always true for genotype-computed LD; false for a
  // pre-computed PLINK file with no DP column, so the display can disable D'.
  hasDprime: boolean
  // How these values were derived ('phased' | 'composite' | 'precomputed'), so
  // the UI can label the precision honestly.
  method: LDMethod
  filterStats: FilterStats
  recombination: RecombinationData
}

function emptyLDResult(metric: LDMetric, method: LDMethod): LDMatrixResult {
  return {
    snps: [],
    ldValues: new Float32Array(0),
    metric,
    hasDprime: true,
    method,
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
  statusCallback?: StatusCallback,
): Float32Array {
  const vals = new Float32Array((n * (n - 1)) / 2)
  // Report once per row (n rows): report() also runs the throttled stop-token
  // check, so cancellation stays responsive without a per-pair check.
  const report = createProgressReporter({
    label: 'Computing LD values',
    total: n,
    statusCallback,
    stopTokenCheck,
  })
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
    }
    report(i)
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
    statusCallback?: StatusCallback
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
  const dataAdapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig,
  })

  // Get all samples from adapter
  const sources = await dataAdapter.getSources(regions)
  const samples = sources.map(s => s.name)

  if (samples.length === 0) {
    return emptyLDResult(ldMetric, 'composite')
  }

  const splitCache: Record<string, string[]> = {}

  const rawFeatures = await updateStatus(
    'Downloading features',
    statusCallback,
    () => dataAdapter.getFeaturesInMultipleRegionsArray(regions, args),
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
      ? new SerializableFilterChain({
          filters: jexlFilters,
          jexl: pluginManager.jexl,
        })
      : null

  // Scan features until one yields a definitive phased/unphased signal. Reading
  // only the first variant's first sample misclassifies a phased file whose
  // leading variants are all no-calls (`./.` carries no phase information).
  let dataIsPhased = false
  for (const feature of rawFeatures) {
    const signal = phaseSignal(
      feature.get('genotypes') as Record<string, string>,
    )
    if (signal !== 'unknown') {
      dataIsPhased = signal === 'phased'
      break
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

    if (filterChain && !filterChain.passes(feature)) {
      continue
    }

    const alt = feature.get('ALT') as string[] | undefined
    if (alt && alt.length > 1) {
      filteredByMultiallelic++
      continue
    }

    const genotypes = feature.get('genotypes') as Record<string, string>

    let packed: ReturnType<typeof packHaplotypesWithCounts> | undefined
    let encodedSlot: Int8Array | undefined
    let nHomRef: number
    let nHet: number
    let nHomAlt: number
    let nValid: number

    if (dataIsPhased) {
      packed = packHaplotypesWithCounts(genotypes, samples)
      ;({ nHomRef, nHet, nHomAlt, nValid } = packed)
    } else {
      encodedSlot = encodedFlat!.subarray(
        snpIdx * nSamples,
        (snpIdx + 1) * nSamples,
      )
      ;({ nHomRef, nHet, nHomAlt, nValid } = fillEncoded(
        encodedSlot,
        genotypes,
        samples,
        splitCache,
      ))
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
      id: feature.get('name'),
      refName: feature.get('refName'),
      start: feature.get('start'),
      end: feature.get('end'),
      maf: Math.min(altFreq, 1 - altFreq),
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
      statusCallback,
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

  return {
    snps,
    ldValues,
    metric: ldMetric,
    hasDprime: true,
    method: dataIsPhased ? 'phased' : 'composite',
    filterStats,
    recombination,
  }
}
