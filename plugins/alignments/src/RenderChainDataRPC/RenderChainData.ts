import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { PileupDataResult } from '../RenderPileupDataRPC/types'
import type { RenderChainDataArgs } from './types.ts'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    RenderChainData: {
      args: Record<string, unknown>
      return: PileupDataResult
    }
  }
}

export default class RenderChainData extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'RenderChainData'

  async execute(args: Record<string, unknown>, _rpcDriver: string) {
    const { executeRenderChainData } =
      await import('./executeRenderChainData.ts')
    return executeRenderChainData({
      pluginManager: this.pluginManager,
      args: args as unknown as RenderChainDataArgs,
    })
  }
}
