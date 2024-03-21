import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { Region, dedupe, groupBy } from '@jbrowse/core/util'
import { RemoteAbortSignal } from '@jbrowse/core/rpc/remoteAbortSignals'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { toArray } from 'rxjs/operators'
import { firstValueFrom } from 'rxjs'
// locals
import { filterForPairs, getInsertSizeStats } from '../util'
import PileupBaseRPC from '../base'
import { getTag } from '../../util'

// specialized get features to return limited data about alignments
export default class PileupGetReducedFeatures extends PileupBaseRPC {
  name = 'PileupGetReducedFeatures'

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
    const des = await this.deserializeArguments(args, rpcDriver)
    const { adapterConfig, sessionId, regions } = des
    const dataAdapter = (
      await getAdapter(this.pluginManager, sessionId, adapterConfig)
    ).dataAdapter as BaseFeatureDataAdapter

    const featuresArray = await firstValueFrom(
      dataAdapter.getFeaturesInMultipleRegions(regions, des).pipe(toArray()),
    )

    const reduced = dedupe(
      featuresArray.map(f => ({
        SA: getTag(f, 'SA'),
        clipPos: f.get('clipPos'),
        end: f.get('end'),
        flags: f.get('flags'),
        id: f.id(),
        name: f.get('name'),
        next_pos: f.get('next_pos'),
        next_ref: f.get('next_ref'),
        pair_orientation: f.get('pair_orientation'),
        refName: f.get('refName'),
        start: f.get('start'),
        strand: f.get('strand'),
        tlen: f.get('template_length'),
      })),
      f => f.id,
    )

    const filtered = filterForPairs(reduced)
    const stats = filtered.length ? getInsertSizeStats(filtered) : undefined
    const chains = groupBy(reduced, f => f.name)

    return {
      chains: Object.values(chains),
      containsNoTransferables: true,
      hasPaired: !!stats,
      stats,
    }
  }
}
