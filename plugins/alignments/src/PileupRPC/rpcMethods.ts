import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { renameRegionsIfNeeded, Region } from '@jbrowse/core/util'
import { RenderArgs } from '@jbrowse/core/rpc/coreRpcMethods'
import { RemoteAbortSignal } from '@jbrowse/core/rpc/remoteAbortSignals'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { toArray } from 'rxjs/operators'

// locals
import { getTagAlt } from '../util'
import { getModificationTypes } from '../BamAdapter/MismatchParser'

export class PileupGetGlobalValueForTag extends RpcMethodType {
  name = 'PileupGetGlobalValueForTag'

  async serializeArguments(
    args: RenderArgs & {
      signal?: AbortSignal
      statusCallback?: (arg: string) => void
    },
    rpcDriverClassName: string,
  ) {
    const { rootModel } = this.pluginManager
    const assemblyManager = rootModel?.session?.assemblyManager
    if (!assemblyManager) {
      throw new Error('no assembly manager available')
    }

    const renamedArgs = await renameRegionsIfNeeded(assemblyManager, args)

    return super.serializeArguments(renamedArgs, rpcDriverClassName)
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
    const pm = this.pluginManager
    const deArgs = await this.deserializeArguments(args, rpcDriverClassName)
    const { adapterConfig, sessionId, regions, tag } = deArgs
    const dataAdapter = (await getAdapter(pm, sessionId, adapterConfig))
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

export class PileupGetVisibleModifications extends RpcMethodType {
  name = 'PileupGetVisibleModifications'

  async serializeArguments(
    args: RenderArgs & {
      signal?: AbortSignal
      statusCallback?: (arg: string) => void
    },
    rpcDriverClassName: string,
  ) {
    const { rootModel } = this.pluginManager
    const assemblyManager = rootModel?.session?.assemblyManager
    if (!assemblyManager) {
      throw new Error('no assembly manager available')
    }

    const renamedArgs = await renameRegionsIfNeeded(assemblyManager, args)

    return super.serializeArguments(renamedArgs, rpcDriverClassName)
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
    const pm = this.pluginManager
    const deArgs = await this.deserializeArguments(args, rpcDriverClassName)
    const { adapterConfig, sessionId, regions } = deArgs
    const dataAdapter = (await getAdapter(pm, sessionId, adapterConfig))
      .dataAdapter as BaseFeatureDataAdapter

    const features = dataAdapter.getFeaturesInMultipleRegions(regions)
    const featuresArray = await features.pipe(toArray()).toPromise()
    const uniqueValues = new Set<string>()
    featuresArray.forEach(feature => {
      const val = (getTagAlt(feature, 'MM', 'Mm') as string) || ''
      if (val !== undefined) {
        getModificationTypes(val).forEach(t => uniqueValues.add(t))
      }
    })
    return [...uniqueValues]
  }
}
