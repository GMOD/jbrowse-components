import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type { ManhattanRpcResult, RenderManhattanDataArgs } from './rpcTypes.ts'

// TODO: add module augmentation once @jbrowse/core exports RpcRegistry
// declare module '@jbrowse/core/rpc/RpcRegistry' {
//   interface RpcRegistry {
//     RenderManhattanData: {
//       args: RenderManhattanDataArgs
//       return: ManhattanRpcResult
//     }
//   }
// }

export default class RenderManhattanData extends RpcMethodType {
  name = 'RenderManhattanData'

  async serializeArguments(
    args: RenderManhattanDataArgs,
    rpcDriver: string,
  ): Promise<RenderManhattanDataArgs> {
    const assemblyManager =
      this.pluginManager.rootModel?.session?.assemblyManager
    if (!assemblyManager) {
      return super.serializeArguments(args, rpcDriver) as Promise<RenderManhattanDataArgs>
    }

    const result = await renameRegionsIfNeeded(assemblyManager, {
      sessionId: args.sessionId,
      adapterConfig: args.adapterConfig,
      regions: [args.region],
    })

    const renamedRegion = result.regions[0]
    return super.serializeArguments(
      renamedRegion ? { ...args, region: renamedRegion } : args,
      rpcDriver,
    ) as Promise<RenderManhattanDataArgs>
  }

  async execute(args: Record<string, unknown>, _rpcDriver: string): Promise<ManhattanRpcResult> {
    const { executeRenderManhattanData } = await import(
      './executeRenderManhattanData.ts'
    )
    return executeRenderManhattanData({
      pluginManager: this.pluginManager,
      args: args as RenderManhattanDataArgs,
    })
  }
}
