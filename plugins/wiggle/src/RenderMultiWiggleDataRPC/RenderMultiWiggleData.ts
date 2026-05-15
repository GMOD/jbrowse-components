import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type { SourceInfo, WiggleDataResult } from '../util.ts'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

interface RenderMultiWiggleDataArgs {
  sessionId: string
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
      return: WiggleDataResult
    }
  }
}

export default class RenderMultiWiggleData extends RpcMethodType {
  name = 'RenderMultiWiggleData'

  async serializeArguments(args: RenderMultiWiggleDataArgs, rpcDriver: string) {
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

  async execute(args: RenderMultiWiggleDataArgs, _rpcDriver: string) {
    const { executeRenderMultiWiggleData } =
      await import('./executeRenderMultiWiggleData.ts')
    return executeRenderMultiWiggleData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
