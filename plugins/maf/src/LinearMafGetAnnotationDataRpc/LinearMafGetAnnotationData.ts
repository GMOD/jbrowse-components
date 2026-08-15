import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type {
  LinearMafGetAnnotationDataArgs,
  LinearMafGetAnnotationDataResult,
} from './executeMafAnnotationData.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    LinearMafGetAnnotationData: {
      args: LinearMafGetAnnotationDataArgs
      return: LinearMafGetAnnotationDataResult
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
