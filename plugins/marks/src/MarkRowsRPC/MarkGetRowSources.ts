import { listsRowSources } from '@jbrowse/core/data_adapters/BaseAdapter/rowSources'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import type { RowSourceListing } from '@jbrowse/core/data_adapters/BaseAdapter/rowSources'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MarkGetRowSources: {
      args: { adapterConfig: Record<string, unknown> }
      return: RowSourceListing | undefined
    }
  }
}

export default class MarkGetRowSources extends RpcMethodType<'MarkGetRowSources'> {
  name = 'MarkGetRowSources' as const

  async execute(args: RpcExecuteArgs<'MarkGetRowSources'>) {
    const dataAdapter = await getFeatureAdapterOrThrow({
      ...args,
      pluginManager: this.pluginManager,
    })
    return listsRowSources(dataAdapter)
      ? dataAdapter.listRowSources(args)
      : undefined
  }
}
