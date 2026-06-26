import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'

import type { WiggleDataResult } from '../util.ts'
import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

interface RenderWiggleDataArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  // All visible regions in one call so the adapter can coalesce reads across
  // them (BigWig). Returns one WiggleDataResult per region, in input order.
  regions: Region[]
  useBicolor?: boolean
  bicolorPivot?: number
  stopToken?: StopToken
  bpPerPx?: number
  resolution?: number
  statusCallback?: StatusCallback
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    RenderWiggleData: {
      args: RenderWiggleDataArgs
      return: WiggleDataResult[]
    }
  }
}

export default class RenderWiggleData extends RpcMethodTypeWithRenameRegions {
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
