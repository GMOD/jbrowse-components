import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { isFeatureAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { Source } from '../shared/types.ts'
import type { MultiSampleVariantGetSourcesArgs } from './types.ts'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiSampleVariantGetSources: {
      args: MultiSampleVariantGetSourcesArgs
      return: Source[]
    }
  }
}

export class MultiSampleVariantGetSources extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'MultiSampleVariantGetSources'

  async execute(
    args: MultiSampleVariantGetSourcesArgs,
    rpcDriverClassName: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { regions, adapterConfig, sessionId } = deserializedArgs
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    if (!isFeatureAdapter(dataAdapter)) {
      throw new Error('Expected a feature data adapter')
    }
    return dataAdapter.getSources(regions ?? [])
  }
}
