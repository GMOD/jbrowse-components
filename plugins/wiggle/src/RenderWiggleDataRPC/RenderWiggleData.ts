import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type { WiggleDataResult } from '../util.ts'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

interface RenderWiggleDataArgs extends Record<string, unknown> {
  adapterConfig: Record<string, unknown>
  region: Region
  bicolorPivot?: number
  stopToken?: StopToken
  bpPerPx?: number
  resolution?: number
  statusCallback?: (msg: string) => void
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    RenderWiggleData: {
      args: RenderWiggleDataArgs
      return: WiggleDataResult
    }
  }
}

export default class RenderWiggleData extends RpcMethodType {
  name = 'RenderWiggleData'

  async serializeArguments(args: RenderWiggleDataArgs, rpcDriver: string) {
    const assemblyManager =
      this.pluginManager.rootModel?.session?.assemblyManager

    if (assemblyManager) {
      const result = await renameRegionsIfNeeded(assemblyManager, {
        sessionId: args.sessionId as string,
        adapterConfig: args.adapterConfig,
        regions: [args.region],
      })

      return super.serializeArguments(
        { ...args, region: result.regions[0] },
        rpcDriver,
      )
    }

    return super.serializeArguments(args, rpcDriver)
  }

  async execute(args: unknown, _rpcDriver: string) {
    const { executeRenderWiggleData } =
      await import('./executeRenderWiggleData.ts')
    return executeRenderWiggleData({
      pluginManager: this.pluginManager,
      // sessionId is added by RpcManager.call() before execute runs
      args: args as RenderWiggleDataArgs & { sessionId: string },
    })
  }
}
