import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import type { ClusterIdentityMatrixArgs } from './executeClusterIdentityMatrix.ts'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiLGVSyntenyClusterIdentityMatrix: {
      args: ClusterIdentityMatrixArgs
      return: { order: number[]; tree: string }
    }
  }
}

export class MultiLGVSyntenyClusterIdentityMatrix extends RpcMethodType {
  name = 'MultiLGVSyntenyClusterIdentityMatrix'

  async serializeArguments(
    args: Record<string, unknown>,
    _rpcDriverClassName: string,
  ) {
    return args
  }

  async execute(
    args: ClusterIdentityMatrixArgs,
    rpcDriverClassName: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { executeClusterIdentityMatrix } = await import(
      './executeClusterIdentityMatrix.ts'
    )
    return executeClusterIdentityMatrix({
      pluginManager: this.pluginManager,
      args: deserializedArgs,
    })
  }
}
