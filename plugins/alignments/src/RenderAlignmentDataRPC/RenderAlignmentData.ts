import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { GroupedAlignmentsResult, RenderAlignmentDataArgs } from './types'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    RenderAlignmentData: {
      args: RenderAlignmentDataArgs
      return: GroupedAlignmentsResult | RegionTooLargeResult
      // only the data half owns buffers to transfer, so only it is wrapped in
      // rpcResult — the refusal marker crosses as itself
      transferables: GroupedAlignmentsResult
    }
  }
}

// Single RPC for both pileup and chain (linked-reads) modes; the worker
// branches on `args.linkedReads`.
export default class RenderAlignmentData extends RpcMethodTypeWithFiltersAndRenameRegions<'RenderAlignmentData'> {
  name = 'RenderAlignmentData' as const

  async execute(args: RpcExecuteArgs<'RenderAlignmentData'>) {
    const { executeRenderAlignmentData } =
      await import('./executeRenderAlignmentData.ts')
    return executeRenderAlignmentData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
