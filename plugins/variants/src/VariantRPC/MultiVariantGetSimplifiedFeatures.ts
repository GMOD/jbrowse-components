import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { firstValueFrom, toArray } from 'rxjs'

import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../shared/minorAlleleFrequencyUtils'

import type { GetSimplifiedFeaturesArgs } from './types'
import type { SampleInfo } from '../shared/types'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

export class MultiVariantGetSimplifiedFeatures extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'MultiVariantGetSimplifiedFeatures'

  async execute(args: GetSimplifiedFeaturesArgs, rpcDriverClassName: string) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const {
      lengthCutoffFilter,
      minorAlleleFrequencyFilter,
      regions,
      adapterConfig,
      sessionId,
    } = deserializedArgs
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )

    const features = getFeaturesThatPassMinorAlleleFrequencyFilter({
      minorAlleleFrequencyFilter,
      lengthCutoffFilter,
      features: await firstValueFrom(
        (dataAdapter as BaseFeatureDataAdapter)
          .getFeaturesInMultipleRegions(regions, deserializedArgs)
          .pipe(toArray()),
      ),
    })

    const sampleInfo = {} as Record<string, SampleInfo>
    let hasPhased = false

    for (const { feature } of features) {
      const samp = feature.get('genotypes') as Record<string, string>
      for (const [key, val] of Object.entries(samp)) {
        const isPhased = val.includes('|')
        hasPhased ||= isPhased
        sampleInfo[key] = {
          maxPloidy: Math.max(
            sampleInfo[key]?.maxPloidy || 0,
            val.split('|').length,
          ),
          isPhased: sampleInfo[key]?.isPhased || isPhased,
        }
      }
    }
    return {
      hasPhased,
      sampleInfo,
      features: features.map(({ feature }) => ({
        id: feature.id(),
        data: {
          start: feature.get('start'),
          end: feature.get('end'),
          refName: feature.get('refName'),
          name: feature.get('name'),
        },
      })),
    }
  }
}
