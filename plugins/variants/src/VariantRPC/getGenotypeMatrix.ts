import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { updateStatus } from '@jbrowse/core/util'
import { checkStopToken2 } from '@jbrowse/core/util/stopToken'
import { firstValueFrom, toArray } from 'rxjs'

import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../shared/minorAlleleFrequencyUtils.ts'
import {
  detectRawMode,
  encodeGenotypeFromRaw,
  getRawCallGenotype,
} from '../shared/rawGenotypes.ts'

import type { Source } from '../shared/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { LastStopTokenCheck, Region } from '@jbrowse/core/util'

const SPLITTER = /[/|]/

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
    bpPerPx: number
    minorAlleleFrequencyFilter: number
    lengthCutoffFilter: number
    statusCallback?: (arg: string) => void
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
    statusCallback,
  } = args
  const adapter = await getAdapter(pluginManager, sessionId, adapterConfig)
  const dataAdapter = adapter.dataAdapter as BaseFeatureDataAdapter

  const rows = Object.fromEntries(sources.map(s => [s.name, [] as number[]]))
  const splitCache = {} as Record<string, string[]>

  const mafs = getFeaturesThatPassMinorAlleleFrequencyFilter({
    minorAlleleFrequencyFilter,
    lengthCutoffFilter,
    stopTokenCheck,
    splitCache,
    features: await updateStatus('Loading features', statusCallback, () =>
      firstValueFrom(
        dataAdapter.getFeaturesInMultipleRegions(regions, args).pipe(toArray()),
      ),
    ),
  })
  const raw = detectRawMode(mafs)
  for (const { feature } of mafs) {
    const callGt = getRawCallGenotype(feature)
    if (callGt && raw) {
      const ploidy = feature.get('ploidy') as number
      for (const { name } of sources) {
        const si = raw.sampleIndexMap.get(name)
        rows[name]!.push(
          si !== undefined ? encodeGenotypeFromRaw(callGt, si, ploidy) : -1,
        )
      }
    } else {
      const genotypes = feature.get('genotypes') as Record<string, string>
      for (const { name } of sources) {
        const val = genotypes[name]!
        const alleles =
          splitCache[val] ?? (splitCache[val] = val.split(SPLITTER))

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

        rows[name]!.push(
          uncalledCount === alleles.length
            ? -1
            : nonRefCount === 0
              ? 0
              : nonRefCount === alleles.length
                ? 2
                : 1,
        )
      }
    }
    checkStopToken2(stopTokenCheck)
  }
  return rows
}
