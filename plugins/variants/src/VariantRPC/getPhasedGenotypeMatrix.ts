import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { checkStopToken2 } from '@jbrowse/core/util/stopToken'
import { firstValueFrom, toArray } from 'rxjs'

import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../shared/minorAlleleFrequencyUtils.ts'

import type { SampleInfo, Source } from '../shared/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { LastStopTokenCheck, Region } from '@jbrowse/core/util'

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
    bpPerPx: number
    minorAlleleFrequencyFilter: number
    lengthCutoffFilter: number
    sampleInfo: Record<string, SampleInfo>
  }
}) {
  const {
    sources,
    minorAlleleFrequencyFilter,
    regions,
    adapterConfig,
    sessionId,
    lengthCutoffFilter,
    stopTokenCheck,
    sampleInfo,
  } = args
  const adapter = await getAdapter(pluginManager, sessionId, adapterConfig)
  const dataAdapter = adapter.dataAdapter as BaseFeatureDataAdapter

  const rows = {} as Record<string, number[]>
  const splitCache = {} as Record<string, string[]>

  for (const { name } of sources) {
    const info = sampleInfo[name]
    const ploidy = info?.maxPloidy ?? 2
    for (let hp = 0; hp < ploidy; hp++) {
      rows[`${name} HP${hp}`] = []
    }
  }

  const mafs = getFeaturesThatPassMinorAlleleFrequencyFilter({
    minorAlleleFrequencyFilter,
    lengthCutoffFilter,
    stopTokenCheck,
    splitCache,
    features: await firstValueFrom(
      dataAdapter.getFeaturesInMultipleRegions(regions, args).pipe(toArray()),
    ),
  })

  for (const { feature } of mafs) {
    const genotypes = feature.get('genotypes') as Record<string, string>
    for (const { name } of sources) {
      const val = genotypes[name]!
      const info = sampleInfo[name]
      const ploidy = info?.maxPloidy ?? 2
      const isPhased = val.includes('|')

      if (isPhased) {
        const alleles = splitCache[val] ?? (splitCache[val] = val.split('|'))
        for (let hp = 0; hp < ploidy; hp++) {
          const allele = alleles[hp]
          const value = allele === '.' || allele === undefined ? -1 : +allele
          rows[`${name} HP${hp}`]!.push(value)
        }
      } else {
        for (let hp = 0; hp < ploidy; hp++) {
          rows[`${name} HP${hp}`]!.push(-1)
        }
      }
    }
    checkStopToken2(stopTokenCheck)
  }
  return rows
}
