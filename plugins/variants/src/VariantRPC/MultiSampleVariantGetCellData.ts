import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { CellDataResult } from './executeVariantCellData.ts'
import type { GetCellDataArgs } from './types.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiSampleVariantGetCellData: {
      args: GetCellDataArgs
      return: CellDataResult | RegionTooLargeResult
      // only the data half owns buffers to transfer, so only it is wrapped in
      // rpcResult — the refusal marker crosses as itself
      transferables: CellDataResult
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
      args,
    })
  }
}
