import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type {
  LinearMafGetAlignmentDataArgs,
  LinearMafGetAlignmentDataResult,
} from './executeMafAlignmentData.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    LinearMafGetAlignmentData: {
      args: LinearMafGetAlignmentDataArgs
      return: LinearMafGetAlignmentDataResult | RegionTooLargeResult
      // only the data half owns buffers to transfer, so only it is wrapped in
      // rpcResult — the refusal marker crosses as itself
      transferables: LinearMafGetAlignmentDataResult
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
