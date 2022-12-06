import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { renameRegionsIfNeeded, Region } from '@jbrowse/core/util'
import { RenderArgs } from '@jbrowse/core/rpc/coreRpcMethods'
import { RemoteAbortSignal } from '@jbrowse/core/rpc/remoteAbortSignals'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { toArray } from 'rxjs/operators'

// locals
import { getTagAlt, getTag } from '../util'
import { filterForPairs, getInsertSizeStats } from './util'
import { getModificationTypes } from '../BamAdapter/MismatchParser'
import { ReducedFeature } from '../shared/fetchChains'

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
    const { adapterConfig, sessionId, regions, tag } =
      await this.deserializeArguments(args, rpcDriver)

    const dataAdapter = (
      await getAdapter(this.pluginManager, sessionId, adapterConfig)
    ).dataAdapter as BaseFeatureDataAdapter

    const features = dataAdapter.getFeaturesInMultipleRegions(regions)
    const featuresArray = await features.pipe(toArray()).toPromise()
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
    const { adapterConfig, sessionId, regions } =
      await this.deserializeArguments(args, rpcDriver)
    const dataAdapter = (
      await getAdapter(this.pluginManager, sessionId, adapterConfig)
    ).dataAdapter as BaseFeatureDataAdapter

    const featuresArray = await dataAdapter
      .getFeaturesInMultipleRegions(regions)
      .pipe(toArray())
      .toPromise()

    const uniqueValues = new Set<string>()
    featuresArray.forEach(f => {
      getModificationTypes(getTagAlt(f, 'MM', 'Mm') || '').forEach(t =>
        uniqueValues.add(t),
      )
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
    const { adapterConfig, sessionId, regions } =
      await this.deserializeArguments(args, rpcDriver)
    const dataAdapter = (
      await getAdapter(this.pluginManager, sessionId, adapterConfig)
    ).dataAdapter as BaseFeatureDataAdapter

    const featuresArray = await dataAdapter
      .getFeaturesInMultipleRegions(regions)
      .pipe(toArray())
      .toPromise()
    const reduced = featuresArray.map(f => ({
      id: f.id(),
      refName: f.get('refName'),
      name: f.get('name'),
      start: f.get('start'),
      end: f.get('end'),
      flags: f.get('flags'),
      tlen: f.get('template_length'),
      pair_orientation: f.get('pair_orientation'),
    }))
    const filtered = filterForPairs(reduced)
    const stats = filtered.length ? getInsertSizeStats(filtered) : undefined
    const chains = {} as { [key: string]: ReducedFeature[] }

    // pair features
    reduced.forEach(f => {
      if (!chains[f.name]) {
        chains[f.name] = []
      }
      chains[f.name].push(f)
    })
    return {
      chains: Object.values(chains),
      stats,
      hasPaired: !!stats,
      containsNoTransferables: true,
    }
  }
}
