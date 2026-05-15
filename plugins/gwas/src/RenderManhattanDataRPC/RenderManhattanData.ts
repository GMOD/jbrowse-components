import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type {
  ManhattanRpcResult,
  RenderManhattanDataArgs,
} from './rpcTypes.ts'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    RenderManhattanData: {
      args: RenderManhattanDataArgs
      return: ManhattanRpcResult
    }
  }
}

export default class RenderManhattanData extends RpcMethodType {
  name = 'RenderManhattanData'

  async serializeArguments(args: RenderManhattanDataArgs, rpcDriver: string) {
    const assemblyManager =
      this.pluginManager.rootModel?.session?.assemblyManager
    if (assemblyManager) {
      const { regions } = await renameRegionsIfNeeded(assemblyManager, {
        sessionId: args.sessionId,
        adapterConfig: args.adapterConfig,
        regions: [args.region],
      })
      return super.serializeArguments(
        regions[0] ? { ...args, region: regions[0] } : args,
        rpcDriver,
      )
    }
    return super.serializeArguments(args, rpcDriver)
  }

  async execute(args: RenderManhattanDataArgs, _rpcDriver: string) {
    const { executeRenderManhattanData } = await import(
      './executeRenderManhattanData.ts'
    )
    return executeRenderManhattanData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
