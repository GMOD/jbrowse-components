import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

interface GetGlobalValueForTagArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  regions: Region[]
  tag: string
  stopToken?: StopToken
  rpcDriverName?: string
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    PileupGetGlobalValueForTag: {
      args: GetGlobalValueForTagArgs
      return: string[]
    }
  }
}

export default class PileupGetGlobalValueForTag extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'PileupGetGlobalValueForTag'

  async execute(args: GetGlobalValueForTagArgs, _rpcDriver: string) {
    const { sessionId, adapterConfig, regions, tag, stopToken } = args

    const dataAdapter = (
      await getAdapter(this.pluginManager, sessionId, adapterConfig)
    ).dataAdapter as BaseFeatureDataAdapter

    const tagValues = new Set<string>()
    for (const region of regions) {
      const features = await firstValueFrom(
        dataAdapter.getFeatures(region, { stopToken }).pipe(toArray()),
      )
      for (const feature of features) {
        const val = feature.get('tags')?.[tag]
        if (val !== undefined) {
          tagValues.add(`${val}`)
        }
      }
    }
    return [...tagValues]
  }
}
