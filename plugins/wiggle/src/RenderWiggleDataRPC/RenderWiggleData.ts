import RpcMethodTypeWithRenameRegion from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegion'

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

export default class RenderWiggleData extends RpcMethodTypeWithRenameRegion {
  name = 'RenderWiggleData'

  async execute(args: RenderWiggleDataArgs, _rpcDriver: string) {
    const { executeRenderWiggleData } =
      await import('./executeRenderWiggleData.ts')
    return executeRenderWiggleData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
