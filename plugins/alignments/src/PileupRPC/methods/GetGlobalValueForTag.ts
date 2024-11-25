import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

// locals
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
    const { adapterConfig, sessionId, regions, tag } =
      await this.deserializeArguments(args, rpcDriver)

    const dataAdapter = (
      await getAdapter(this.pluginManager, sessionId, adapterConfig)
    ).dataAdapter as BaseFeatureDataAdapter

    const features = dataAdapter.getFeaturesInMultipleRegions(regions)
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
