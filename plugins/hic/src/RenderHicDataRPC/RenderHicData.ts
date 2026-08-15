import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'

import type { HicDataResult, RenderHicDataArgs } from './types.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    RenderHicData: {
      args: RenderHicDataArgs
      return: HicDataResult
    }
  }
}

export default class RenderHicData extends RpcMethodTypeWithRenameRegions<'RenderHicData'> {
  name = 'RenderHicData' as const

  async execute(args: RpcExecuteArgs<'RenderHicData'>) {
    const { executeRenderHicData } = await import('./executeRenderHicData.ts')
    return executeRenderHicData({
      pluginManager: this.pluginManager,
      args: args,
    })
  }
}
