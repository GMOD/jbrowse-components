import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type {
  LinearMafGetSummaryDataArgs,
  LinearMafGetSummaryDataResult,
} from './executeMafSummaryData.ts'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    LinearMafGetSummaryData: {
      args: LinearMafGetSummaryDataArgs
      return: LinearMafGetSummaryDataResult
    }
  }
}

export default class LinearMafGetSummaryData extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'LinearMafGetSummaryData'

  async execute(args: LinearMafGetSummaryDataArgs, rpcDriverClassName: string) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { executeMafSummaryData } = await import('./executeMafSummaryData.ts')
    return executeMafSummaryData({
      pluginManager: this.pluginManager,
      args: deserializedArgs,
    })
  }
}
