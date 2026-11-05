import { listsRowSources } from '@jbrowse/core/data_adapters/BaseAdapter/rowSources'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import type PluginManager from '@jbrowse/core/PluginManager'
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

/**
 * The rows an adapter lists over its sources, a multi-BigWig's files or a
 * MAF's species, or undefined for an adapter that lists none.
 */
export async function executeGetRowSources({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RpcExecuteArgs<'MarkGetRowSources'>
}) {
  const dataAdapter = await getFeatureAdapterOrThrow({ ...args, pluginManager })
  return listsRowSources(dataAdapter)
    ? dataAdapter.listRowSources(args)
    : undefined
}

export default class MarkGetRowSources extends RpcMethodType<'MarkGetRowSources'> {
  name = 'MarkGetRowSources' as const

  async execute(args: RpcExecuteArgs<'MarkGetRowSources'>) {
    return executeGetRowSources({ pluginManager: this.pluginManager, args })
  }
}
