import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { firstValueFrom, toArray } from 'rxjs'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export class MultiVariantGetSimplifiedFeatures extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'MultiVariantGetSimplifiedFeatures'

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
    const { minorAlleleFrequencyFilter, sources, regions, adapterConfig, sessionId } =
      deserializedArgs
    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)
    const feats = await firstValueFrom(
      (dataAdapter as BaseFeatureDataAdapter)
        .getFeaturesInMultipleRegions(regions, deserializedArgs)
        .pipe(toArray()),
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
          c / sources.length > minorAlleleFrequencyFilter &&
          c2 / sources.length < 1 - minorAlleleFrequencyFilter
        ) {
          mafs.push(feat)
        }
      }
    }
    return mafs.map(f => ({
      id: f.id(),
      data: {
        start: f.get('start'),
        end: f.get('end'),
        refName: f.get('refName'),
      },
    }))
  }
}
