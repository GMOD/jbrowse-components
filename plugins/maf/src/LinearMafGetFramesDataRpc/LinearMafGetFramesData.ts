import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type {
  LinearMafGetFramesDataArgs,
  LinearMafGetFramesDataResult,
} from './executeMafFramesData.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    LinearMafGetFramesData: {
      args: LinearMafGetFramesDataArgs
      return: LinearMafGetFramesDataResult | RegionTooLargeResult
    }
  }
}

export default class LinearMafGetFramesData extends RpcMethodTypeWithFiltersAndRenameRegions<'LinearMafGetFramesData'> {
  name = 'LinearMafGetFramesData' as const

  async execute(args: RpcExecuteArgs<'LinearMafGetFramesData'>) {
    const { executeMafFramesData } = await import('./executeMafFramesData.ts')
    return executeMafFramesData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
