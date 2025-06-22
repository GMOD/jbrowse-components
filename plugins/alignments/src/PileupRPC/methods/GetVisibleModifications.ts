import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { getModTypes } from '../../ModificationParser/getModTypes'
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
    const deserializeArguments = await this.deserializeArguments(
      args,
      rpcDriver,
    )
    const { adapterConfig, sessionId, regions } = deserializeArguments
    const dataAdapter = (
      await getAdapter(this.pluginManager, sessionId, adapterConfig)
    ).dataAdapter as BaseFeatureDataAdapter

    const featuresArray = await firstValueFrom(
      dataAdapter
        .getFeaturesInMultipleRegions(regions, deserializeArguments)
        .pipe(toArray()),
    )

    const uniqueModifications = new Map<string, ModificationType>()
    for (const feat of featuresArray) {
      const mmTag = getTagAlt(feat, 'MM', 'Mm')
      for (const mod of getModTypes(typeof mmTag === 'string' ? mmTag : '')) {
        if (!uniqueModifications.has(mod.type)) {
          uniqueModifications.set(mod.type, mod)
        }
      }
    }
    return [...uniqueModifications.values()]
  }
}
