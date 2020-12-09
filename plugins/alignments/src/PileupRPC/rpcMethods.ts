import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'
import { Region } from '@jbrowse/core/util/types'
import { RemoteAbortSignal } from '@jbrowse/core/rpc/remoteAbortSignals'
import { toArray } from 'rxjs/operators'

// 2nd option, here do adapter.getFeatures.forEach(feature, add value to map)
// goal of the rpc method would be to get the adapter
// in args get the displayedRegion, in getFeatures used the displayedRegion

// const deserializedArgs = await this.deserializeArguments(args)
// const { adapterConfig, sessionId } = deserializedArgs
// const { dataAdapter } = getAdapter(
//   this.pluginManager,
//   sessionId,
//   adapterConfig,
// )
// then dataAdapter.getFeatures
// and return the map
// when making rpc function, make sure to test with renamed references
// use tracks under the integration track category
// if it doesnt work, main culprit is renameRegionsIfNeeded in the serializedArguments
// probably dont need to deserialize
// async be careful, in LinearPileupDisplay model.ts, when calling the rpcMethod, it will be async
// so will probably have to do action, set volalitle value, after value gets set then do next step

export class PileupGetGlobalValueForTag extends RpcMethodType {
  name = 'PileupGetGlobalValueForTag'

  async execute(args: {
    adapterConfig: {}
    signal?: RemoteAbortSignal
    headers?: Record<string, string>
    displayedRegions: Region[]
    sessionId: string
    tag: string
  }): Promise<Set<string>> {
    const deserializedArgs = await this.deserializeArguments(args)
    const {
      adapterConfig,
      sessionId,
      displayedRegions,
      tag,
      signal,
    } = deserializedArgs
    const { dataAdapter } = getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )

    const features = dataAdapter.getFeatures(displayedRegions[0])
    const featuresArray = await features.pipe(toArray()).toPromise()

    const uniqueValues = new Set()
    featuresArray.forEach(feature => {
      const val = feature.get('tags')
        ? feature.get('tags')[tag]
        : feature.get(tag)
      if (val) uniqueValues.add(val)
    })

    return uniqueValues
  }
}
