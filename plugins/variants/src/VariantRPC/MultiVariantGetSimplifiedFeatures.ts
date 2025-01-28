import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { firstValueFrom, toArray } from 'rxjs'

import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../util'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'
import { SampleInfo } from '../types'

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
    const { minorAlleleFrequencyFilter, regions, adapterConfig, sessionId } =
      deserializedArgs
    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)
    const feats = await firstValueFrom(
      (dataAdapter as BaseFeatureDataAdapter)
        .getFeaturesInMultipleRegions(regions, deserializedArgs)
        .pipe(toArray()),
    )

    const features = getFeaturesThatPassMinorAlleleFrequencyFilter(
      feats,
      minorAlleleFrequencyFilter,
    )

    const sampleInfo = {} as Record<string, SampleInfo>
    let hasPhased = false

    for (const f of features) {
      const samp = f.get('genotypes') as Record<string, string>
      for (const [key, val] of Object.entries(samp)) {
        const isPhased = val.includes('|')
        hasPhased ||= isPhased
        sampleInfo[key] = {
          maxPloidy: Math.max(
            sampleInfo[key]?.maxPloidy || 0,
            val.split(/|/).length,
          ),
          isPhased: sampleInfo[key]?.isPhased || isPhased,
        }
      }
    }
    return {
      hasPhased,
      sampleInfo,
      features: features.map(f => ({
        id: f.id(),
        data: {
          start: f.get('start'),
          end: f.get('end'),
          refName: f.get('refName'),
        },
      })),
    }
  }
}
