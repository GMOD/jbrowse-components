import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import type { Region } from '@jbrowse/core/util'

interface SubgraphAdapter {
  getSubgraph(region: Region): Promise<string>
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    GetSubgraph: {
      args: {
        adapterConfig: Record<string, unknown>
        region: Region
        sessionId: string
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
    const { adapterConfig, region, sessionId } = deserializedArgs as {
      adapterConfig: Record<string, unknown>
      region: Region
      sessionId: string
    }

    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    const adapter = dataAdapter as unknown as Partial<SubgraphAdapter>
    if (typeof adapter.getSubgraph !== 'function') {
      return ''
    }
    return adapter.getSubgraph(region)
  }
}
