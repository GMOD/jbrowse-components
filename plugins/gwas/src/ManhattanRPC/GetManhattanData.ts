import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type {
  GetManhattanDataArgs,
  ManhattanRpcResult,
} from './rpcTypes.ts'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    GetManhattanData: {
      args: GetManhattanDataArgs
      return: ManhattanRpcResult
    }
  }
}

export default class GetManhattanData extends RpcMethodType {
  name = 'GetManhattanData'

  async serializeArguments(args: GetManhattanDataArgs, rpcDriver: string) {
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

  async execute(args: GetManhattanDataArgs, _rpcDriver: string) {
    const { executeGetManhattanData } = await import(
      './executeGetManhattanData.ts'
    )
    return executeGetManhattanData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
