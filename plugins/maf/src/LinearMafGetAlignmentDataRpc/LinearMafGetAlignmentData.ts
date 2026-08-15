import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type {
  LinearMafGetAlignmentDataArgs,
  LinearMafGetAlignmentDataResult,
} from './executeMafAlignmentData.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { RpcResult } from '@jbrowse/core/util/librpc'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    LinearMafGetAlignmentData: {
      args: LinearMafGetAlignmentDataArgs
      return: LinearMafGetAlignmentDataResult
    }
  }
}

export default class LinearMafGetAlignmentData extends RpcMethodTypeWithFiltersAndRenameRegions<
  'LinearMafGetAlignmentData',
  RpcResult<LinearMafGetAlignmentDataResult>
> {
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
