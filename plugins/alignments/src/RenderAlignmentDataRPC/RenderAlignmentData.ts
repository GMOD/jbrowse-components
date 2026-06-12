import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { GroupedAlignmentsResult, RenderAlignmentDataArgs } from './types'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    RenderAlignmentData: {
      args: RenderAlignmentDataArgs
      return: GroupedAlignmentsResult
    }
  }
}

// Single RPC for both pileup and chain (linked-reads) modes; the worker
// branches on `args.linkedReads`.
export default class RenderAlignmentData extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'RenderAlignmentData'

  async execute(args: RenderAlignmentDataArgs, _rpcDriver: string) {
    const { executeRenderAlignmentData } =
      await import('./executeRenderAlignmentData.ts')
    return executeRenderAlignmentData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
