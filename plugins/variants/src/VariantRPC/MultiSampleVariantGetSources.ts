import { isFeatureAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { Source } from '../shared/types.ts'
import type { MultiSampleVariantGetSourcesArgs } from './types.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiSampleVariantGetSources: {
      args: MultiSampleVariantGetSourcesArgs
      return: Source[]
    }
  }
}

export class MultiSampleVariantGetSources extends RpcMethodTypeWithFiltersAndRenameRegions<'MultiSampleVariantGetSources'> {
  name = 'MultiSampleVariantGetSources' as const

  async execute(args: RpcExecuteArgs<'MultiSampleVariantGetSources'>) {
    const { regions, adapterConfig, sessionId } = args
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    if (!isFeatureAdapter(dataAdapter)) {
      throw new Error('Expected a feature data adapter')
    }
    // The whole deserialized bag as opts, so the handles ride along. The
    // default `getSources` has no index to consult — it scans every feature in
    // every region to collect the source names — and this was calling it with
    // no opts at all, which on a large panel is a full scan that cannot be
    // cancelled and reports nothing.
    return dataAdapter.getSources(regions ?? [], args)
  }
}
