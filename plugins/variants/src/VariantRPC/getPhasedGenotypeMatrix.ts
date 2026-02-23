import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { updateStatus } from '@jbrowse/core/util'
import { checkStopToken2 } from '@jbrowse/core/util/stopToken'
import { firstValueFrom, toArray } from 'rxjs'

import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../shared/minorAlleleFrequencyUtils.ts'
import { detectRawMode, getRawCallGenotype } from '../shared/rawGenotypes.ts'

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
    sampleInfo,
    statusCallback,
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
      const callGtPhased = feature.get('callGenotypePhased') as
        | Uint8Array
        | undefined
      const gtPloidy = feature.get('ploidy') as number
      for (const { name } of sources) {
        const si = raw.sampleIndexMap.get(name)
        const info = sampleInfo[name]
        const maxPloidy = info?.maxPloidy ?? 2
        const phased = si !== undefined && callGtPhased?.[si]
        if (!phased) {
          for (let hp = 0; hp < maxPloidy; hp++) {
            rows[`${name} HP${hp}`]!.push(-1)
          }
        } else {
          for (let hp = 0; hp < maxPloidy; hp++) {
            const a = hp < gtPloidy ? callGt[si * gtPloidy + hp]! : -1
            rows[`${name} HP${hp}`]!.push(a === -1 || a === -2 ? -1 : a)
          }
        }
      }
    } else {
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
    }
    checkStopToken2(stopTokenCheck)
  }
  return rows
}
