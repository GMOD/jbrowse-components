import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { forEachWithStopTokenCheck } from '@jbrowse/core/util'
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
      stopToken,
      sessionId,
    } = deserializedArgs
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )

    const rawFeatures = await firstValueFrom(
      (dataAdapter as BaseFeatureDataAdapter)
        .getFeaturesInMultipleRegions(regions, deserializedArgs)
        .pipe(toArray()),
    )

    const sampleInfo = {} as Record<string, SampleInfo>
    const genotypesCache = new Map<string, Record<string, string>>()
    let hasPhased = false

    const features = getFeaturesThatPassMinorAlleleFrequencyFilter({
      minorAlleleFrequencyFilter,
      lengthCutoffFilter,
      stopToken,
      features: rawFeatures,
      genotypesCache,
    })

    forEachWithStopTokenCheck(features, stopToken, ({ feature }) => {
      const featureId = feature.id()
      let samp = genotypesCache.get(featureId)
      if (!samp) {
        samp = feature.get('genotypes') as Record<string, string>
        genotypesCache.set(featureId, samp)
      }

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
    })
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
