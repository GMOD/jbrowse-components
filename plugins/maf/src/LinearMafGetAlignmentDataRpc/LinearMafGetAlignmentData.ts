import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type {
  LinearMafGetAlignmentDataArgs,
  LinearMafGetAlignmentDataResult,
} from './executeMafAlignmentData.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    LinearMafGetAlignmentData: {
      args: LinearMafGetAlignmentDataArgs
      return: LinearMafGetAlignmentDataResult
      // wrapped in rpcResult so postMessage transfers its buffers
      transferables: true
    }
  }
}

export default class LinearMafGetAlignmentData extends RpcMethodTypeWithFiltersAndRenameRegions<'LinearMafGetAlignmentData'> {
  name = 'LinearMafGetAlignmentData' as const

  async execute(args: RpcExecuteArgs<'LinearMafGetAlignmentData'>) {
    const { executeMafAlignmentData } =
      await import('./executeMafAlignmentData.ts')
    return executeMafAlignmentData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
