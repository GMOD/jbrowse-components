import RpcMethodTypeWithRenameRegion from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegion'

import type { SourceInfo, WiggleDataResult } from '../util.ts'
import type { Region, StatusCallback } from '@jbrowse/core/util'
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
  statusCallback?: StatusCallback
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    RenderMultiWiggleData: {
      args: RenderMultiWiggleDataArgs
      return: WiggleDataResult
    }
  }
}

export default class RenderMultiWiggleData extends RpcMethodTypeWithRenameRegion {
  name = 'RenderMultiWiggleData'

  async execute(args: RenderMultiWiggleDataArgs, _rpcDriver: string) {
    const { executeRenderMultiWiggleData } =
      await import('./executeRenderMultiWiggleData.ts')
    return executeRenderMultiWiggleData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
