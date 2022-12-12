import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { renameRegionsIfNeeded, Region, dedupe } from '@jbrowse/core/util'
import { RenderArgs } from '@jbrowse/core/rpc/coreRpcMethods'
import { RemoteAbortSignal } from '@jbrowse/core/rpc/remoteAbortSignals'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { toArray } from 'rxjs/operators'

// locals
import { filterForPairs, getInsertSizeStats } from '../util'
import { ReducedFeature } from '../../shared/fetchChains'

// specialized get features to return limited data about alignments
export default class PileupGetReducedFeatures extends RpcMethodType {
  name = 'PileupGetReducedFeatures'

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

    console.log('here', featuresArray)
    const reduced = dedupe(
      featuresArray.map(f => ({
        id: f.id(),
        refName: f.get('refName'),
        name: f.get('name'),
        start: f.get('start'),
        strand: f.get('strand'),
        end: f.get('end'),
        flags: f.get('flags'),
        tlen: f.get('template_length'),
        pair_orientation: f.get('pair_orientation'),
        next_refName: f.get('next_ref'),
        next_pos: f.get('next_segment_pos'),
        next_segment_position: f.get('next_segment_position'),
        clipPos: f.get('clipPos'),
      })),
      f => f.id,
    )

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
