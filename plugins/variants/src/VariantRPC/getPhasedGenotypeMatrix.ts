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
    bpPerPx?: number
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

  const rows: Record<string, number[]> = {}
  // Hoist per-source key resolution, max ploidy, and per-haplotype row-name
  // strings out of the feature loop — all are constant per source. Also keep
  // direct rowArrays references parallel to per-haplotype slots so the inner
  // loop can push without a dict lookup per cell.
  const resolved = sources.map(s => {
    const maxPloidy = sampleInfo[s.name]?.maxPloidy ?? 2
    const rowArrays: number[][] = []
    for (let hp = 0; hp < maxPloidy; hp++) {
      const arr: number[] = []
      rows[`${s.name} HP${hp}`] = arr
      rowArrays.push(arr)
    }
    return {
      name: s.name,
      key: s.sampleName ?? s.name,
      maxPloidy,
      rowArrays,
      rawIdx: -1,
    }
  })

  const mafs = getFeaturesThatPassMinorAlleleFrequencyFilter({
    minorAlleleFrequencyFilter,
    lengthCutoffFilter,
    stopTokenCheck,
    features: await updateStatus('Loading features', statusCallback, () =>
      firstValueFrom(
        dataAdapter.getFeaturesInMultipleRegions(regions, args).pipe(toArray()),
      ),
    ),
  })

  const raw = detectRawMode(mafs)
  if (raw) {
    for (const r of resolved) {
      const idx = raw.sampleIndexMap.get(r.key)
      r.rawIdx = idx ?? -1
    }
  }
  for (const { feature } of mafs) {
    const callGt = getRawCallGenotype(feature)
    if (callGt && raw) {
      const callGtPhased = feature.get('callGenotypePhased') as
        | Uint8Array
        | undefined
      const gtPloidy = feature.get('ploidy') as number
      for (const r of resolved) {
        const si = r.rawIdx
        const phased = si !== -1 && callGtPhased?.[si]
        const arrs = r.rowArrays
        if (!phased) {
          for (let hp = 0; hp < r.maxPloidy; hp++) {
            arrs[hp]!.push(-1)
          }
        } else {
          for (let hp = 0; hp < r.maxPloidy; hp++) {
            const a = hp < gtPloidy ? callGt[si * gtPloidy + hp]! : -1
            arrs[hp]!.push(a === -1 || a === -2 ? -1 : a)
          }
        }
      }
    } else {
      const genotypes = feature.get('genotypes') as Record<string, string>
      for (const r of resolved) {
        const val = genotypes[r.key]!
        const arrs = r.rowArrays
        if (val.includes('|')) {
          const alleles = val.split('|')
          for (let hp = 0; hp < r.maxPloidy; hp++) {
            const allele = alleles[hp]
            const value = allele === '.' || allele === undefined ? -1 : +allele
            arrs[hp]!.push(value)
          }
        } else {
          for (let hp = 0; hp < r.maxPloidy; hp++) {
            arrs[hp]!.push(-1)
          }
        }
      }
    }
    checkStopToken2(stopTokenCheck)
  }
  return rows
}
