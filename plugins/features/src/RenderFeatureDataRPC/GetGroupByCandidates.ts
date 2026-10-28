import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'

import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

export default class GetGroupByCandidates extends RpcMethodTypeWithRenameRegions<'GetBasicGroupByCandidates'> {
  name = 'GetBasicGroupByCandidates' as const

  async execute(args: RpcExecuteArgs<'GetBasicGroupByCandidates'>) {
    const { executeGetGroupByCandidates } =
      await import('./executeGetGroupByCandidates.ts')
    return executeGetGroupByCandidates({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
