import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { RemoteAbortSignal } from '@jbrowse/core/rpc/remoteAbortSignals'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { Region } from '@jbrowse/core/util'
import { toArray } from 'rxjs/operators'
import { firstValueFrom } from 'rxjs'

// locals
import { ModificationType } from '../../shared/types'
import { getModTypes } from '../../ModificationParser'
import { getTagAlt } from '../../util'
import PileupBaseRPC from '../base'

export default class PileupGetVisibleModifications extends PileupBaseRPC {
  name = 'PileupGetVisibleModifications'

  async execute(
    args: {
      adapterConfig: Record<string, unknown>
      stopToken?: RemoteAbortSignal
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

    const featuresArray = await firstValueFrom(
      dataAdapter.getFeaturesInMultipleRegions(regions).pipe(toArray()),
    )

    const uniqueModifications = new Map<string, ModificationType>()
    featuresArray.forEach(f => {
      for (const mod of getModTypes(getTagAlt(f, 'MM', 'Mm') || '')) {
        if (!uniqueModifications.has(mod.type)) {
          uniqueModifications.set(mod.type, mod)
        }
      }
    })
    return [...uniqueModifications.values()]
  }
}
