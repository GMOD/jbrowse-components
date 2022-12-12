import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { renameRegionsIfNeeded, Region } from '@jbrowse/core/util'
import { RenderArgs } from '@jbrowse/core/rpc/coreRpcMethods'
import { RemoteAbortSignal } from '@jbrowse/core/rpc/remoteAbortSignals'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { toArray } from 'rxjs/operators'

// locals
import { getModificationTypes } from '../../BamAdapter/MismatchParser'
import PileupBaseRPC from '../base'
import { getTagAlt } from '../../util'

export default class PileupGetVisibleModifications extends PileupBaseRPC {
  name = 'PileupGetVisibleModifications'

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
