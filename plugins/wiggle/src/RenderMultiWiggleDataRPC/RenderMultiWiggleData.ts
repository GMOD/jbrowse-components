import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type { MultiWiggleDataResult } from './types.ts'
import type { SourceInfo } from '../util.ts'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

interface RenderMultiWiggleDataArgs extends Record<string, unknown> {
  adapterConfig: Record<string, unknown>
  region: Region
  sources?: SourceInfo[]
  bicolorPivot?: number
  stopToken?: StopToken
  bpPerPx?: number
  resolution?: number
  statusCallback?: (msg: string) => void
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    RenderMultiWiggleData: {
      args: RenderMultiWiggleDataArgs
      return: MultiWiggleDataResult
    }
  }
}

export default class RenderMultiWiggleData extends RpcMethodType {
  name = 'RenderMultiWiggleData'

  async serializeArguments(args: RenderMultiWiggleDataArgs, rpcDriver: string) {
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
    const { executeRenderMultiWiggleData } =
      await import('./executeRenderMultiWiggleData.ts')
    return executeRenderMultiWiggleData({
      pluginManager: this.pluginManager,
      // sessionId is added by RpcManager.call() before execute runs
      args: args as RenderMultiWiggleDataArgs & { sessionId: string },
    })
  }
}
