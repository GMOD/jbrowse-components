import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

// locals
import { getModTypes } from '../../ModificationParser'
import { getTagAlt } from '../../util'
import PileupBaseRPC from '../base'
import type { ModificationType } from '../../shared/types'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'

export default class PileupGetVisibleModifications extends PileupBaseRPC {
  name = 'PileupGetVisibleModifications'

  async execute(
    args: {
      adapterConfig: Record<string, unknown>
      stopToken?: string
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
