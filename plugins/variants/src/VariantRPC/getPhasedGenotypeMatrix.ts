import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { createProgressReporter, updateStatus } from '@jbrowse/core/util'

import { resolveSampleName } from '../shared/getSources.ts'
import { hasProcessGenotypes } from '../shared/hasProcessGenotypes.ts'
import { getFilteredVariants } from '../shared/minorAlleleFrequencyUtils.ts'
import {
  MISSING,
  readPhasedAlleleIndicators,
} from './genotypeMatrixEncoding.ts'

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

  // Flatten sources to one entry per output row, up front. A source that
  // already names one haplotype ("HG001 HP0", carrying `HP`) contributes just
  // that row and keeps its own name — that's how a re-cluster over a
  // subtree-filtered set arrives, where one haplotype of a sample can be
  // visible and the other not. An unexpanded sample contributes one row per
  // haplotype under the `"<sampleName> HP<n>"` convention in
  // shared/getSources.ts. Either way the order matches
  // expandSourcesToHaplotypes, which is what lets the caller line the returned
  // `order` up with its own rows.
  const rowSpecs = sources.flatMap(s => {
    const key = resolveSampleName(s)
    return s.HP === undefined
      ? Array.from({ length: sampleInfo[s.name]?.maxPloidy ?? 2 }, (_, hp) => ({
          key,
          hp,
          name: `${s.name} HP${hp}`,
        }))
      : [{ key, hp: s.HP, name: s.name }]
  })

  const rawFeatures = await updateStatus(
    'Downloading features',
    statusCallback,
    () => dataAdapter.getFeaturesInMultipleRegionsArray(regions, args),
  )
  const filteredVariants = getFilteredVariants({
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

  // Pre-size each haplotype row to the filtered-variant count and assign by
  // feature index.
  // Float32 because a haplotype with nothing to say (no-call, unphased call,
  // sample absent) has to be NaN rather than a value on the allele scale — see
  // genotypeMatrixEncoding.ts.
  const numFeatures = filteredVariants.length
  const rows: Record<string, Float32Array> = {}
  const rowArrays = rowSpecs.map(spec => {
    const arr = new Float32Array(numFeatures)
    rows[spec.name] = arr
    return arr
  })

  // Mirrors getGenotypeMatrix's fast path: iterate genotypes via
  // processGenotypes into a reusable per-sample scratch buffer indexed by
  // sample-array position, no genotypes Record and no substring per call. This
  // path matters more here than there — phased mode builds twice the rows.
  const sampleNames =
    filteredVariants.length > 0
      ? ((filteredVariants[0]!.feature.get('sampleNames') as
          | string[]
          | undefined) ?? [])
      : []
  const samplesLen = sampleNames.length
  const sampleIdxByKey = new Map<string, number>()
  for (let i = 0; i < samplesLen; i++) {
    sampleIdxByKey.set(sampleNames[i]!, i)
  }
  // Wide enough to index every haplotype some row asks for, which for a
  // pre-expanded source is its own HP rather than a ploidy count.
  let maxPloidy = 1
  for (const spec of rowSpecs) {
    if (spec.hp + 1 > maxPloidy) {
      maxPloidy = spec.hp + 1
    }
  }
  const used = new Uint8Array(samplesLen)
  const rowSampleIdx = Int32Array.from(rowSpecs, spec => {
    const idx = sampleIdxByKey.get(spec.key) ?? -1
    if (idx !== -1) {
      used[idx] = 1
    }
    return idx
  })
  const rowHp = Int32Array.from(rowSpecs, spec => spec.hp)
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
    const feature = filteredVariants[f]!.feature
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
      for (let k = 0; k < rowArrays.length; k++) {
        const idx = rowSampleIdx[k]!
        rowArrays[k]![f] =
          idx === -1 ? MISSING : indicators[idx * maxPloidy + rowHp[k]!]!
      }
    } else {
      const genotypes = feature.get('genotypes') as Record<string, string>
      // Rows of one sample are adjacent, so its genotype is scanned once and
      // read by each of its haplotype rows.
      let scannedKey: string | undefined
      for (let k = 0; k < rowArrays.length; k++) {
        const { key, hp } = rowSpecs[k]!
        if (key !== scannedKey) {
          const val = genotypes[key]
          readPhasedAlleleIndicators(
            val ?? '',
            0,
            val?.length ?? 0,
            scratch,
            0,
            maxPloidy,
          )
          scannedKey = key
        }
        rowArrays[k]![f] = scratch[hp]!
      }
    }
    report(f)
  }
  return rows
}
