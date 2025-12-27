import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
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
    const lastCheck = createStopTokenChecker(stopToken)

    const features = getFeaturesThatPassMinorAlleleFrequencyFilter({
      minorAlleleFrequencyFilter,
      lengthCutoffFilter,
      lastCheck,
      features: rawFeatures,
      genotypesCache,
    })

    for (const { feature } of features) {
      const featureId = feature.id()
      let samp = genotypesCache.get(featureId)
      if (!samp) {
        samp = feature.get('genotypes') as Record<string, string>
        genotypesCache.set(featureId, samp)
      }

      for (const [key, val] of Object.entries(samp)) {
        const isPhased = val.includes('|')
        hasPhased ||= isPhased
        let ploidy = 1
        if (isPhased) {
          for (const char of val) {
            if (char === '|') {
              ploidy++
            }
          }
        }
        const existing = sampleInfo[key]
        sampleInfo[key] = {
          maxPloidy: Math.max(existing?.maxPloidy ?? 0, ploidy),
          isPhased: existing?.isPhased || isPhased,
        }
      }
      checkStopToken2(lastCheck)
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
