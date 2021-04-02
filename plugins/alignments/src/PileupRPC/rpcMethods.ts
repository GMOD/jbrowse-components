import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { RenderArgs } from '@jbrowse/core/rpc/coreRpcMethods'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'
import { Region } from '@jbrowse/core/util/types'
import { RemoteAbortSignal } from '@jbrowse/core/rpc/remoteAbortSignals'
import { toArray } from 'rxjs/operators'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

export class PileupGetGlobalValueForTag extends RpcMethodType {
  name = 'PileupGetGlobalValueForTag'

  async serializeArguments(
    args: RenderArgs & { signal?: AbortSignal; statusCallback?: Function },
  ) {
    const assemblyManager = this.pluginManager.rootModel?.session
      ?.assemblyManager
    if (!assemblyManager) {
      return args
    }

    return renameRegionsIfNeeded(assemblyManager, args)
  }

  async execute(
    args: {
      adapterConfig: {}
      signal?: RemoteAbortSignal
      headers?: Record<string, string>
      regions: Region[]
      sessionId: string
      tag: string
    },
    rpcDriverClassName: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { adapterConfig, sessionId, regions, tag } = deserializedArgs
    const dataAdapter = getAdapter(this.pluginManager, sessionId, adapterConfig)
      .dataAdapter as BaseFeatureDataAdapter

    const features = dataAdapter.getFeaturesInMultipleRegions(regions)
    const featuresArray = await features.pipe(toArray()).toPromise()
    const uniqueValues = new Set<string>()
    featuresArray.forEach(feature => {
      const tags = feature.get('tags')
      const val = tags ? tags[tag] : feature.get(tag)
      if (val !== undefined) {
        uniqueValues.add(`${val}`)
      }
    })
    return [...uniqueValues]
  }
}
