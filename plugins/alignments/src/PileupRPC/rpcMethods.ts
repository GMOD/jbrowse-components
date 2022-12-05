import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { renameRegionsIfNeeded, Region } from '@jbrowse/core/util'
import { RenderArgs } from '@jbrowse/core/rpc/coreRpcMethods'
import { RemoteAbortSignal } from '@jbrowse/core/rpc/remoteAbortSignals'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { toArray } from 'rxjs/operators'

// locals
import { getTagAlt, getTag } from '../util'
import { getModificationTypes } from '../BamAdapter/MismatchParser'
import { ReducedFeature } from '../shared/fetchPairs'

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
    const reduced = featuresArray
      .filter(f => f.get('flags') & 1)
      .map(f => ({
        id: f.id(),
        refName: f.get('refName'),
        name: f.get('name'),
        start: f.get('start'),
        end: f.get('end'),
        flags: f.get('flags'),
        tlen: f.get('template_length'),
        pair_orientation: f.get('pair_orientation'),
      }))
    const stats = getFilteredInsertSizeStats(reduced)
    const pairedFeatures = {} as { [key: string]: ReducedFeature[] }

    // pair features
    reduced.forEach(f => {
      if (!pairedFeatures[f.name]) {
        pairedFeatures[f.name] = []
      }
      pairedFeatures[f.name].push(f)
    })
    return { pairedFeatures, stats }
  }
}

function getInsertSizeStats(features: ReducedFeature[]) {
  const filtered = features.map(f => Math.abs(f.tlen))
  const sum = filtered.reduce((a, b) => a + b, 0)
  const sum2 = filtered.map(a => a * a).reduce((a, b) => a + b, 0)
  const total = filtered.length
  const avg = sum / total
  const sd = Math.sqrt((total * sum2 - sum * sum) / (total * total))
  const upper = avg + 4 * sd
  const lower = avg - 2 * sd
  return { upper, lower, avg, sd }
}

function getFilteredInsertSizeStats(features: ReducedFeature[]) {
  return getInsertSizeStats(
    // stats gathered from 'properly paired' features (flag 2)
    features.filter(f => f.flags & 2 && !(f.flags & 256) && !(f.flags & 2048)),
  )
}
