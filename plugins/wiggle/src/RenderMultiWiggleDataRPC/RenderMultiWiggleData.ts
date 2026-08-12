import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'

import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { SourceInfo, WiggleDataResult } from '@jbrowse/wiggle-core'

interface RenderMultiWiggleDataArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  // All visible regions in one call so each subtrack's adapter can coalesce
  // reads across them (BigWig). Returns one WiggleDataResult per region, in
  // input order.
  regions: Region[]
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
      return: WiggleDataResult[]
    }
  }
}

export default class RenderMultiWiggleData extends RpcMethodTypeWithRenameRegions<'RenderMultiWiggleData'> {
  name = 'RenderMultiWiggleData'

  async execute(args: RenderMultiWiggleDataArgs, rpcDriverClassName: string) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { executeRenderMultiWiggleData } =
      await import('./executeRenderMultiWiggleData.ts')
    return executeRenderMultiWiggleData({
      pluginManager: this.pluginManager,
      args: deserializedArgs,
    })
  }
}
