import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type { HicDataResult, RenderHicDataArgs } from './types.ts'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    RenderHicData: {
      args: RenderHicDataArgs
      return: HicDataResult
    }
  }
}

export default class RenderHicData extends RpcMethodType {
  name = 'RenderHicData'

  async serializeArguments(args: RenderHicDataArgs, rpcDriver: string) {
    const assemblyManager =
      this.pluginManager.rootModel?.session?.assemblyManager

    if (assemblyManager && args.regions.length) {
      const { regions } = await renameRegionsIfNeeded(assemblyManager, {
        sessionId: args.sessionId,
        adapterConfig: args.adapterConfig,
        regions: args.regions,
      })

      return super.serializeArguments({ ...args, regions }, rpcDriver)
    }

    return super.serializeArguments(args, rpcDriver)
  }

  async execute(args: RenderHicDataArgs, _rpcDriver: string) {
    const { executeRenderHicData } = await import('./executeRenderHicData.ts')
    return executeRenderHicData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
