import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { CellDataResult } from './executeVariantCellData.ts'
import type { GetCellDataArgs } from './types.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiSampleVariantGetCellData: {
      args: GetCellDataArgs
      return: CellDataResult
    }
  }
}

export class MultiSampleVariantGetCellData extends RpcMethodTypeWithFiltersAndRenameRegions<'MultiSampleVariantGetCellData'> {
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
