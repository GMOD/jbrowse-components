import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'

import type { HicDataResult, RenderHicDataArgs } from './types.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    RenderHicData: {
      args: RenderHicDataArgs
      return: HicDataResult
      // wrapped in rpcResult so postMessage transfers its buffers
      transferables: true
    }
  }
}

export default class RenderHicData extends RpcMethodTypeWithRenameRegions<'RenderHicData'> {
  name = 'RenderHicData' as const

  override preload() {
    return import('./executeRenderHicData.ts')
  }

  async execute(args: RpcExecuteArgs<'RenderHicData'>) {
    const { executeRenderHicData } = await this.preload()
    return executeRenderHicData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
