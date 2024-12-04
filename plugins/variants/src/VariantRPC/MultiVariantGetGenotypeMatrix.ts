import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { firstValueFrom, toArray } from 'rxjs'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

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
    const { sources, mafFilter, regions, adapterConfig, sessionId } =
      deserializedArgs
    const adapter = await getAdapter(pm, sessionId, adapterConfig)
    const dataAdapter = adapter.dataAdapter as BaseFeatureDataAdapter
    const region = regions[0]

    const feats = await firstValueFrom(
      dataAdapter.getFeatures(region, deserializedArgs).pipe(toArray()),
    )

    // a 'factor' in the R sense of the term (ordinal)
    const genotypeFactor = new Set<string>()
    const mafs = [] as Feature[]
    for (const feat of feats) {
      let c = 0
      let c2 = 0
      const samp = feat.get('genotypes')

      // only draw smallish indels
      if (feat.get('end') - feat.get('start') <= 10) {
        for (const { name } of sources) {
          const s = samp[name]!
          genotypeFactor.add(s)
          if (s === '0|0' || s === './.') {
            c2++
          } else if (s === '1|0' || s === '0|1') {
            c++
          } else if (s === '1|1') {
            c++
            c2++
          } else {
            c++
          }
        }
        if (
          c / sources.length > mafFilter &&
          c2 / sources.length < 1 - mafFilter
        ) {
          mafs.push(feat)
        }
      }
    }

    const genotypeFactorMap = Object.fromEntries(
      [...genotypeFactor].map((type, idx) => [type, idx]),
    )
    const rows = {} as Record<string, { name: string; genotypes: number[] }>
    for (const feat of mafs) {
      const samp = feat.get('genotypes') as Record<string, string>
      for (const { name } of sources) {
        if (!rows[name]) {
          rows[name] = { name, genotypes: [] }
        }
        rows[name].genotypes.push(genotypeFactorMap[samp[name]!]!)
      }
    }

    return rows
  }
}
