import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { CellDataResult } from './executeVariantCellData.ts'
import type { GetCellDataArgs } from './types.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { RpcResult } from '@jbrowse/core/util/librpc'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiSampleVariantGetCellData: {
      args: GetCellDataArgs
      return: CellDataResult
    }
  }
}

export class MultiSampleVariantGetCellData extends RpcMethodTypeWithFiltersAndRenameRegions<
  'MultiSampleVariantGetCellData',
  RpcResult<CellDataResult>
> {
  name = 'MultiSampleVariantGetCellData' as const

  async execute(args: RpcExecuteArgs<'MultiSampleVariantGetCellData'>) {
    const { executeVariantCellData } =
      await import('./executeVariantCellData.ts')
    return executeVariantCellData({
      pluginManager: this.pluginManager,
      args: args,
    })
  }
}
