import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { WiggleGetSourcesArgs } from './types.ts'
import type { Source } from '../util.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiWiggleGetSources: {
      args: WiggleGetSourcesArgs
      return: Source[]
    }
  }
}

export class MultiWiggleGetSources extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'MultiWiggleGetSources'

  async execute(args: WiggleGetSourcesArgs, rpcDriverClassName: string) {
    const pm = this.pluginManager
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { regions, adapterConfig, sessionId } = deserializedArgs
    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)
    const featureAdapter = dataAdapter as BaseFeatureDataAdapter
    return featureAdapter.getSources(regions)
  }
}
