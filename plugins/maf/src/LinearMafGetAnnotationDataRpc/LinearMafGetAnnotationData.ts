import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type {
  LinearMafGetAnnotationDataArgs,
  LinearMafGetAnnotationDataResult,
} from './executeMafAnnotationData.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    LinearMafGetAnnotationData: {
      args: LinearMafGetAnnotationDataArgs
      return: LinearMafGetAnnotationDataResult | RegionTooLargeResult
    }
  }
}

export default class LinearMafGetAnnotationData extends RpcMethodTypeWithFiltersAndRenameRegions<'LinearMafGetAnnotationData'> {
  name = 'LinearMafGetAnnotationData' as const

  async execute(args: RpcExecuteArgs<'LinearMafGetAnnotationData'>) {
    const { executeMafAnnotationData } =
      await import('./executeMafAnnotationData.ts')
    return executeMafAnnotationData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
