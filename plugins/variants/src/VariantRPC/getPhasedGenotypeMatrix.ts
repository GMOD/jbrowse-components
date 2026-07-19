import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { createProgressReporter, updateStatus } from '@jbrowse/core/util'

import { resolveSampleName } from '../shared/getSources.ts'
import { getFilteredVariants } from '../shared/minorAlleleFrequencyUtils.ts'

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
  // Int16 is wide enough for VCF allele indices including pathological
  // multi-allelic sites, well past Int8's 127-allele cap.
  const numFeatures = mafs.length
  const rows: Record<string, Int16Array> = {}
  const rowArraysBySrc: Int16Array[][] = resolved.map(r => {
    const arrs: Int16Array[] = []
    for (let hp = 0; hp < r.maxPloidy; hp++) {
      const arr = new Int16Array(numFeatures)
      rows[`${r.name} HP${hp}`] = arr
      arrs.push(arr)
    }
    return arrs
  })

  const report = createProgressReporter({
    label: 'Building genotype matrix',
    total: numFeatures,
    statusCallback,
    stopTokenCheck,
  })
  for (let f = 0; f < numFeatures; f++) {
    const feature = mafs[f]!.feature
    const genotypes = feature.get('genotypes') as Record<string, string>
    for (let k = 0; k < resolved.length; k++) {
      const r = resolved[k]!
      const val = genotypes[r.key]!
      const arrs = rowArraysBySrc[k]!
      if (val.includes('|')) {
        const alleles = val.split('|')
        for (let hp = 0; hp < r.maxPloidy; hp++) {
          const allele = alleles[hp]
          const value = allele === '.' || allele === undefined ? -1 : +allele
          arrs[hp]![f] = value
        }
      } else {
        for (let hp = 0; hp < r.maxPloidy; hp++) {
          arrs[hp]![f] = -1
        }
      }
    }
    report(f)
  }
  return rows
}
