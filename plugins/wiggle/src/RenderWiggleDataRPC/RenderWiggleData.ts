import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type { WiggleDataResult } from '../util.ts'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

interface RenderWiggleDataArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  region: Region
  useBicolor?: boolean
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

  async execute(args: RenderWiggleDataArgs, _rpcDriver: string) {
    const { executeRenderWiggleData } =
      await import('./executeRenderWiggleData.ts')
    return executeRenderWiggleData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
