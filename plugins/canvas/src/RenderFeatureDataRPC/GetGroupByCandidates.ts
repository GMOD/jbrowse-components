import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'

import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

export default class GetGroupByCandidates extends RpcMethodTypeWithRenameRegions<'GetCanvasGroupByCandidates'> {
  name = 'GetCanvasGroupByCandidates' as const

  async execute(args: RpcExecuteArgs<'GetCanvasGroupByCandidates'>) {
    const { executeGetGroupByCandidates } =
      await import('./executeGetGroupByCandidates.ts')
    return executeGetGroupByCandidates({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
