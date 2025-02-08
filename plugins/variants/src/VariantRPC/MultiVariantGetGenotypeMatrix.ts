import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { firstValueFrom, toArray } from 'rxjs'

import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../shared/minorAlleleFrequencyUtils'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'

export class MultiVariantGetGenotypeMatrix extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'MultiVariantGetGenotypeMatrix'

  async execute(
    args: {
      adapterConfig: AnyConfigurationModel
      stopToken?: string
      sessionId: string
      headers?: Record<string, string>
      regions: Region[]
      bpPerPx: number
    },
    rpcDriverClassName: string,
  ) {
    const pm = this.pluginManager
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const {
      sources,
      minorAlleleFrequencyFilter,
      regions,
      adapterConfig,
      sessionId,
    } = deserializedArgs
    const adapter = await getAdapter(pm, sessionId, adapterConfig)
    const dataAdapter = adapter.dataAdapter as BaseFeatureDataAdapter
    const region = regions[0]

    const feats = await firstValueFrom(
      dataAdapter.getFeatures(region, deserializedArgs).pipe(toArray()),
    )

    const genotypeFactor = new Set<string>()
    const mafs = getFeaturesThatPassMinorAlleleFrequencyFilter(
      feats,
      minorAlleleFrequencyFilter,
    )

    for (const feat of feats) {
      const samp = feat.get('genotypes') as Record<string, string>
      for (const { name } of sources) {
        const s = samp[name]!
        genotypeFactor.add(s)
      }
    }

    const genotypeFactorMap = Object.fromEntries(
      [...genotypeFactor].map((type, idx) => [type, idx]),
    )
    const rows = {} as Record<string, { name: string; genotypes: number[] }>
    for (const { feature } of mafs) {
      const samp = feature.get('genotypes') as Record<string, string>
      for (const { name } of sources) {
        if (!rows[name]) {
          rows[name] = {
            name,
            genotypes: [],
          }
        }
        rows[name].genotypes.push(genotypeFactorMap[samp[name]!]!)
      }
    }

    return rows
  }
}
