import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { forEachWithStopTokenCheck } from '@jbrowse/core/util'
import { firstValueFrom, toArray } from 'rxjs'

import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../shared/minorAlleleFrequencyUtils'

import type { GetGenotypeMatrixArgs } from './types'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

export async function getGenotypeMatrix({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: GetGenotypeMatrixArgs
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
  const adapter = await getAdapter(pluginManager, sessionId, adapterConfig)
  const dataAdapter = adapter.dataAdapter as BaseFeatureDataAdapter

  const rows = Object.fromEntries(sources.map(s => [s.name, [] as number[]]))
  const splitCache = {} as Record<string, string[]>

  const mafs = getFeaturesThatPassMinorAlleleFrequencyFilter({
    minorAlleleFrequencyFilter,
    lengthCutoffFilter,
    stopToken,
    splitCache,
    features: await firstValueFrom(
      dataAdapter.getFeaturesInMultipleRegions(regions, args).pipe(toArray()),
    ),
  })
  forEachWithStopTokenCheck(mafs, stopToken, ({ feature }) => {
    const genotypes = feature.get('genotypes') as Record<string, string>
    for (const { name } of sources) {
      const val = genotypes[name]!
      const alleles = splitCache[val] ?? (splitCache[val] = val.split(/[/|]/))

      let nonRefCount = 0
      let uncalledCount = 0
      for (const allele of alleles) {
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
  })
  return rows
}
