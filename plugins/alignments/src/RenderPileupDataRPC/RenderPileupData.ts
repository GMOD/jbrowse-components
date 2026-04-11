import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { PileupDataResult, RenderPileupDataArgs } from './types'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    RenderPileupData: {
      args: RenderPileupDataArgs
      return: PileupDataResult
    }
  }
}

export default class RenderPileupData extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'RenderPileupData'

  async execute(args: RenderPileupDataArgs, _rpcDriver: string) {
    const { executeRenderPileupData } =
      await import('./executeRenderPileupData.ts')
    return executeRenderPileupData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
