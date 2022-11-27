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
    rpcDriver: string,
  ) {
    const { rootModel } = this.pluginManager
    const assemblyManager = rootModel?.session?.assemblyManager
    if (!assemblyManager) {
      throw new Error('no assembly manager available')
    }

    const renamedArgs = await renameRegionsIfNeeded(assemblyManager, args)

    return super.serializeArguments(renamedArgs, rpcDriver)
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
    rpcDriver: string,
  ) {
    const pm = this.pluginManager
    const deArgs = await this.deserializeArguments(args, rpcDriver)
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
    rpcDriver: string,
  ) {
    const { rootModel } = this.pluginManager
    const assemblyManager = rootModel?.session?.assemblyManager
    if (!assemblyManager) {
      throw new Error('no assembly manager available')
    }

    const renamedArgs = await renameRegionsIfNeeded(assemblyManager, args)

    return super.serializeArguments(renamedArgs, rpcDriver)
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
    rpcDriver: string,
  ) {
    const pm = this.pluginManager
    const deArgs = await this.deserializeArguments(args, rpcDriver)
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

// specialized get features to return limited data about alignments
export class PileupGetFeatures extends RpcMethodType {
  name = 'PileupGetFeatures'

  async serializeArguments(
    args: RenderArgs & {
      signal?: AbortSignal
      statusCallback?: (arg: string) => void
    },
    rpcDriver: string,
  ) {
    const { rootModel } = this.pluginManager
    const assemblyManager = rootModel?.session?.assemblyManager
    if (!assemblyManager) {
      throw new Error('no assembly manager available')
    }

    const renamedArgs = await renameRegionsIfNeeded(assemblyManager, args)

    return super.serializeArguments(renamedArgs, rpcDriver)
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
    rpcDriver: string,
  ) {
    const pm = this.pluginManager
    const deArgs = await this.deserializeArguments(args, rpcDriver)
    const { adapterConfig, sessionId, regions } = deArgs
    const dataAdapter = (await getAdapter(pm, sessionId, adapterConfig))
      .dataAdapter as BaseFeatureDataAdapter

    const features = dataAdapter.getFeaturesInMultipleRegions(regions)
    const featuresArray = await features.pipe(toArray()).toPromise()
    const reduced = featuresArray.map(f => ({
      id: f.id(),
      refName: f.get('refName'),
      name: f.get('name'),
      start: f.get('start'),
      end: f.get('end'),
      flags: f.get('flags'),
    }))

    type ReducedFeature = typeof reduced[0]
    const map = {} as { [key: string]: ReducedFeature[] }

    // pair features
    reduced
      .filter(f => f.flags & 1)
      .forEach(f => {
        if (!map[f.name]) {
          map[f.name] = []
        }
        map[f.name].push(f)
      })
    return map
  }
}
