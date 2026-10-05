import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type {
  LinearMafGetSummaryDataArgs,
  LinearMafGetSummaryDataResult,
} from './executeMafSummaryData.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    LinearMafGetSummaryData: {
      args: LinearMafGetSummaryDataArgs
      return: LinearMafGetSummaryDataResult | RegionTooLargeResult
    }
  }
}

export default class LinearMafGetSummaryData extends RpcMethodTypeWithFiltersAndRenameRegions<'LinearMafGetSummaryData'> {
  name = 'LinearMafGetSummaryData' as const

  override preload() {
    return import('./executeMafSummaryData.ts')
  }

  async execute(args: RpcExecuteArgs<'LinearMafGetSummaryData'>) {
    const { executeMafSummaryData } = await this.preload()
    return executeMafSummaryData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
