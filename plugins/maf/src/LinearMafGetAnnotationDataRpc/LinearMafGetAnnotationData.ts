import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type {
  LinearMafGetAnnotationDataArgs,
  LinearMafGetAnnotationDataResult,
} from './executeMafAnnotationData.ts'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    LinearMafGetAnnotationData: {
      args: LinearMafGetAnnotationDataArgs
      return: LinearMafGetAnnotationDataResult
    }
  }
}

export default class LinearMafGetAnnotationData extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'LinearMafGetAnnotationData'

  async execute(
    args: LinearMafGetAnnotationDataArgs,
    rpcDriverClassName: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { executeMafAnnotationData } = await import(
      './executeMafAnnotationData.ts'
    )
    return executeMafAnnotationData({
      pluginManager: this.pluginManager,
      args: deserializedArgs,
    })
  }
}
