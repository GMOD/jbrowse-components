import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { firstValueFrom, toArray } from 'rxjs'

import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../shared/minorAlleleFrequencyUtils'

import type { Source } from '../shared/types'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

const SPLITTER = /[/|]/

export async function getGenotypeMatrix({
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
    sources: Source[]
    bpPerPx: number
    minorAlleleFrequencyFilter: number
    lengthCutoffFilter: number
  }
}) {
  const {
    sources,
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

  const rows = Object.fromEntries(sources.map(s => [s.name, [] as number[]]))
  const splitCache = {} as Record<string, string[]>

  const mafs = getFeaturesThatPassMinorAlleleFrequencyFilter({
    minorAlleleFrequencyFilter,
    lengthCutoffFilter,
    lastCheck,
    splitCache,
    features: await firstValueFrom(
      dataAdapter.getFeaturesInMultipleRegions(regions, args).pipe(toArray()),
    ),
  })
  for (const { feature } of mafs) {
    const genotypes = feature.get('genotypes') as Record<string, string>
    for (const { name } of sources) {
      const val = genotypes[name]!
      const alleles = splitCache[val] ?? (splitCache[val] = val.split(SPLITTER))

      let nonRefCount = 0
      let uncalledCount = 0
      for (let i = 0, l = alleles.length; i < l; i++) {
        const allele = alleles[i]!
        if (allele === '.') {
          uncalledCount++
        } else if (allele !== '0') {
          nonRefCount++
        }
      }

      const genotypeStatus =
        uncalledCount === alleles.length
          ? -1
          : nonRefCount === 0
            ? 0
            : nonRefCount === alleles.length
              ? 2
              : 1

      rows[name]!.push(genotypeStatus)
    }
    checkStopToken2(lastCheck)
  }
  return rows
}
