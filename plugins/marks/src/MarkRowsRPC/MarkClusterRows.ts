import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'

import type { MarkClusterRowsResult, MarkRowMatrixArgs } from './rpcTypes.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

// In a file the import graph reaches, or every call site reads
// NotInRpcRegistry.
declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MarkClusterRows: {
      args: MarkRowMatrixArgs
      return: MarkClusterRowsResult
    }
  }
}

export default class MarkClusterRows extends RpcMethodTypeWithRenameRegions<'MarkClusterRows'> {
  name = 'MarkClusterRows' as const

  async execute(args: RpcExecuteArgs<'MarkClusterRows'>) {
    const { clusterMarkRows } = await import('./clusterMarkRows.ts')
    return clusterMarkRows({ pluginManager: this.pluginManager, args })
  }
}
