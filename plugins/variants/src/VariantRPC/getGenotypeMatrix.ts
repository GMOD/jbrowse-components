import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { createProgressReporter, updateStatus } from '@jbrowse/core/util'

import { resolveSampleName } from '../shared/getSources.ts'
import { hasProcessGenotypes } from '../shared/hasProcessGenotypes.ts'
import { getFilteredVariants } from '../shared/minorAlleleFrequencyUtils.ts'
import { classifyGenotypeDosage } from '../shared/parseGenotypeDosage.ts'
import { MISSING } from './genotypeMatrixEncoding.ts'

import type { Source } from '../shared/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import type {
  LastStopTokenCheck,
  Region,
  StatusCallback,
} from '@jbrowse/core/util'

export async function getGenotypeMatrix({
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
    statusCallback,
  } = args
  const dataAdapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig,
  })

  // Hoist sample-key resolution out of the per-feature loop. Per (source ×
  // feature) the previous code recomputed `sampleName ?? name`, constant per
  // source.
  const resolved = sources.map(s => ({
    name: s.name,
    key: resolveSampleName(s),
  }))

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

  // Pre-size each row to the filtered-variant count and assign by feature
  // index — eliminates dynamic-growth reallocs vs push. Float32 rather than a
  // packed integer type because a no-call has to be NaN, not a value on the
  // dosage scale (see genotypeMatrixEncoding.ts). rowArrays parallels
  // `resolved` so the inner loop writes to a direct reference rather than a
  // string-keyed Record lookup per cell.
  const numFeatures = filteredVariants.length
  const rows: Record<string, Float32Array> = {}
  const rowArrays: Float32Array[] = []
  for (const r of resolved) {
    const arr = new Float32Array(numFeatures)
    rows[r.name] = arr
    rowArrays.push(arr)
  }

  // Set up the allocation-free non-raw path: per feature, iterate genotypes
  // via processGenotypes (no Record / no substring slices) into a reusable
  // dosage buffer indexed by sample-array position. Falls back to the
  // genotypes-Record path if features don't support processGenotypes.
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
  const used = new Uint8Array(samplesLen)
  const dosages = new Int8Array(samplesLen)
  const resolvedSampleIdx = resolved.map(r => {
    const idx = sampleIdxByKey.get(r.key) ?? -1
    if (idx !== -1) {
      used[idx] = 1
    }
    return idx
  })

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
      // feature's dosage standing in that slot.
      dosages.fill(-1)
      feature.processGenotypes((str, start, end, sampleIdx) => {
        if (used[sampleIdx]) {
          dosages[sampleIdx] = classifyGenotypeDosage(str, start, end)
        }
      })
      for (let k = 0; k < rowArrays.length; k++) {
        const idx = resolvedSampleIdx[k]!
        const dosage = idx === -1 ? -1 : dosages[idx]!
        rowArrays[k]![f] = dosage === -1 ? MISSING : dosage
      }
    } else {
      const genotypes = feature.get('genotypes') as Record<string, string>
      for (let k = 0; k < resolved.length; k++) {
        const dosage = classifyGenotypeDosage(genotypes[resolved[k]!.key] ?? '')
        rowArrays[k]![f] = dosage === -1 ? MISSING : dosage
      }
    }
    report(f)
  }
  return rows
}
