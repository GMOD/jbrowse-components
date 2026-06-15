import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'

import type { HicDataResult, RenderHicDataArgs } from './types.ts'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    RenderHicData: {
      args: RenderHicDataArgs
      return: HicDataResult
    }
  }
}

export default class RenderHicData extends RpcMethodTypeWithRenameRegions {
  name = 'RenderHicData'

  async execute(args: RenderHicDataArgs, _rpcDriver: string) {
    const { executeRenderHicData } = await import('./executeRenderHicData.ts')
    return executeRenderHicData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
