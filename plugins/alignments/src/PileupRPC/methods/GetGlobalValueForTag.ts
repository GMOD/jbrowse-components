import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { Region } from '@jbrowse/core/util'
import { RemoteAbortSignal } from '@jbrowse/core/rpc/remoteAbortSignals'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { toArray } from 'rxjs/operators'
import { firstValueFrom } from 'rxjs'

// locals
import PileupBaseRPC from '../base'
import { getTag } from '../../util'

export default class PileupGetGlobalValueForTag extends PileupBaseRPC {
  name = 'PileupGetGlobalValueForTag'

  async execute(
    args: {
      adapterConfig: {}
      signal?: RemoteAbortSignal
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
          .map(feature => getTag(feature, tag))
          .filter(f => f !== undefined)
          .map(f => `${f}`),
      ),
    ]
  }
}
