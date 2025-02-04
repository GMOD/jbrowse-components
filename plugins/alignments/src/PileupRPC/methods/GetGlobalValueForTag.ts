import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import PileupBaseRPC from '../base'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'

export default class PileupGetGlobalValueForTag extends PileupBaseRPC {
  name = 'PileupGetGlobalValueForTag'

  async execute(
    args: {
      adapterConfig: Record<string, unknown>
      stopToken?: string
      headers?: Record<string, string>
      regions: Region[]
      sessionId: string
      tag: string
    },
    rpcDriver: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(args, rpcDriver)
    const { adapterConfig, sessionId, regions, tag } = deserializedArgs

    const dataAdapter = (
      await getAdapter(this.pluginManager, sessionId, adapterConfig)
    ).dataAdapter as BaseFeatureDataAdapter

    const features = dataAdapter.getFeaturesInMultipleRegions(
      regions,
      deserializedArgs,
    )
    const featuresArray = await firstValueFrom(features.pipe(toArray()))
    return [
      ...new Set(
        featuresArray
          .map(feature => feature.get('tags')?.[tag])
          .filter(f => f !== undefined)
          .map(f => `${f}`),
      ),
    ]
  }
}
