import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { createProgressReporter, updateStatus } from '@jbrowse/core/util'

import { resolveSampleName } from '../shared/getSources.ts'
import { getFilteredVariants } from '../shared/minorAlleleFrequencyUtils.ts'
import { MISSING, readPhasedAlleleIndicators } from './genotypeMatrixEncoding.ts'
import { hasProcessGenotypes } from './hasProcessGenotypes.ts'

import type { SampleInfo, Source } from '../shared/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import type {
  LastStopTokenCheck,
  Region,
  StatusCallback,
} from '@jbrowse/core/util'

export async function getPhasedGenotypeMatrix({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: {
    adapterConfig: AnyConfigurationModel
    stopTokenCheck?: LastStopTokenCheck
    sessionId: string
    headers?: Record<string, string>
    regions: Region[]
    sources: Source[]
    bpPerPx?: number
    minorAlleleFrequencyFilter: number
    maxMissingnessFilter: number
    filters?: SerializableFilterChain
    sampleInfo: Record<string, SampleInfo>
    statusCallback?: StatusCallback
  }
}) {
  const {
    sources,
    minorAlleleFrequencyFilter,
    maxMissingnessFilter,
    filters,
    regions,
    adapterConfig,
    sessionId,
    stopTokenCheck,
    sampleInfo,
    statusCallback,
  } = args
  const dataAdapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig,
  })

  // Hoist per-source key resolution and max ploidy out of the feature loop.
  // Build per-source resolved entries first; row buffers are pre-sized to
  // mafs.length once mafs is fetched.
  const resolved = sources.map(s => ({
    name: s.name,
    key: resolveSampleName(s),
    maxPloidy: sampleInfo[s.name]?.maxPloidy ?? 2,
  }))

  const rawFeatures = await updateStatus(
    'Downloading features',
    statusCallback,
    () => dataAdapter.getFeaturesInMultipleRegionsArray(regions, args),
  )
  const mafs = getFilteredVariants({
    minorAlleleFrequencyFilter,
    maxMissingnessFilter,
    filterChain: filters,
    features: rawFeatures,
    report: createProgressReporter({
      label: 'Filtering variants',
      total: rawFeatures.length,
      statusCallback,
      stopTokenCheck,
    }),
  })

  // Pre-size each haplotype row to mafs.length and assign by feature index.
  // Float32 because a haplotype with nothing to say (no-call, unphased call,
  // sample absent) has to be NaN rather than a value on the allele scale — see
  // genotypeMatrixEncoding.ts.
  const numFeatures = mafs.length
  const rows: Record<string, Float32Array> = {}
  const rowArraysBySrc: Float32Array[][] = resolved.map(r => {
    const arrs: Float32Array[] = []
    for (let hp = 0; hp < r.maxPloidy; hp++) {
      const arr = new Float32Array(numFeatures)
      rows[`${r.name} HP${hp}`] = arr
      arrs.push(arr)
    }
    return arrs
  })

  // Mirrors getGenotypeMatrix's fast path: iterate genotypes via
  // processGenotypes into a reusable per-sample scratch buffer indexed by
  // sample-array position, no genotypes Record and no substring per call. This
  // path matters more here than there — phased mode builds twice the rows.
  const sampleNames =
    mafs.length > 0
      ? ((mafs[0]!.feature.get('sampleNames') as string[] | undefined) ?? [])
      : []
  const samplesLen = sampleNames.length
  const sampleIdxByKey = new Map<string, number>()
  for (let i = 0; i < samplesLen; i++) {
    sampleIdxByKey.set(sampleNames[i]!, i)
  }
  let maxPloidy = 1
  for (const r of resolved) {
    if (r.maxPloidy > maxPloidy) {
      maxPloidy = r.maxPloidy
    }
  }
  const used = new Uint8Array(samplesLen)
  const resolvedSampleIdx = resolved.map(r => {
    const idx = sampleIdxByKey.get(r.key) ?? -1
    if (idx !== -1) {
      used[idx] = 1
    }
    return idx
  })
  // Per-sample haplotype indicators for the feature being read, laid out
  // [sample0 hp0..hpN, sample1 hp0..hpN, ...]. One flat buffer rather than a
  // subarray view per sample, which would allocate inside the hot loop.
  const indicators = new Float32Array(samplesLen * maxPloidy)
  const scratch = new Float32Array(maxPloidy)

  const report = createProgressReporter({
    label: 'Building genotype matrix',
    total: numFeatures,
    statusCallback,
    stopTokenCheck,
  })
  for (let f = 0; f < numFeatures; f++) {
    const feature = mafs[f]!.feature
    if (hasProcessGenotypes(feature) && samplesLen > 0) {
      // Reset first: @gmod/vcf skips the callback for a sample whose FORMAT
      // fields stop before GT, which would otherwise leave the previous
      // feature's alleles standing in that slot.
      indicators.fill(MISSING)
      feature.processGenotypes((str, start, end, sampleIdx) => {
        if (used[sampleIdx]) {
          readPhasedAlleleIndicators(
            str,
            start,
            end,
            indicators,
            sampleIdx * maxPloidy,
            maxPloidy,
          )
        }
      })
      for (let k = 0; k < resolved.length; k++) {
        const idx = resolvedSampleIdx[k]!
        const arrs = rowArraysBySrc[k]!
        const base = idx * maxPloidy
        for (let hp = 0; hp < arrs.length; hp++) {
          arrs[hp]![f] = idx === -1 ? MISSING : indicators[base + hp]!
        }
      }
    } else {
      const genotypes = feature.get('genotypes') as Record<string, string>
      for (let k = 0; k < resolved.length; k++) {
        const val = genotypes[resolved[k]!.key]
        const arrs = rowArraysBySrc[k]!
        readPhasedAlleleIndicators(
          val ?? '',
          0,
          val?.length ?? 0,
          scratch,
          0,
          maxPloidy,
        )
        for (let hp = 0; hp < arrs.length; hp++) {
          arrs[hp]![f] = scratch[hp]!
        }
      }
    }
    report(f)
  }
  return rows
}
