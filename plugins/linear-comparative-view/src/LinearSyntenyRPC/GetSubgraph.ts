import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import type { Region } from '@jbrowse/core/util'

interface SubgraphOpts {
  maxPathsEmitted?: number
  context?: number
}

interface SubgraphAdapter {
  getSubgraph(region: Region, opts?: SubgraphOpts): Promise<string>
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    GetSubgraph: {
      args: {
        adapterConfig: Record<string, unknown>
        region: Region
        sessionId: string
        opts?: SubgraphOpts
      }
      return: string
    }
  }
}

export class GetSubgraph extends RpcMethodType {
  name = 'GetSubgraph'

  async serializeArguments(
    args: Record<string, unknown>,
    _rpcDriverClassName: string,
  ) {
    return args
  }

  async execute(args: Record<string, unknown>, rpcDriverClassName: string) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { adapterConfig, region, sessionId, opts } = deserializedArgs as {
      adapterConfig: Record<string, unknown>
      region: Region
      sessionId: string
      opts?: SubgraphOpts
    }

    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    const adapter = dataAdapter as unknown as Partial<SubgraphAdapter>
    if (typeof adapter.getSubgraph !== 'function') {
      console.warn(
        '[GetSubgraph RPC] Adapter does not implement getSubgraph:',
        dataAdapter.constructor.name,
      )
      return ''
    }
    const result = await adapter.getSubgraph(region, opts)
    return result
  }
}
