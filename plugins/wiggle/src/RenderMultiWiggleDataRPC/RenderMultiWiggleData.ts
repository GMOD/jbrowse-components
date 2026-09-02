import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'

import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Region } from '@jbrowse/core/util'
import type { SourceInfo, WiggleDataResult } from '@jbrowse/wiggle-core'

interface RenderMultiWiggleDataArgs {
  adapterConfig: Record<string, unknown>
  // All visible regions in one call so each subtrack's adapter can coalesce
  // reads across them (BigWig). Returns one WiggleDataResult per region, in
  // input order.
  regions: Region[]
  sources?: SourceInfo[]
  bicolorPivot?: number
  bpPerPx?: number
  resolution?: number
  // The display's raw summary slot, forwarded to the adapter so one that stores
  // min/max separately can skip reading them for a mode that cannot show them.
  // Optional: a caller that omits it gets the summary either way.
  summaryScoreMode?: string
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    RenderMultiWiggleData: {
      args: RenderMultiWiggleDataArgs
      return: WiggleDataResult[]
      // wrapped in rpcResult so postMessage transfers its buffers
      transferables: true
    }
  }
}

export default class RenderMultiWiggleData extends RpcMethodTypeWithRenameRegions<'RenderMultiWiggleData'> {
  name = 'RenderMultiWiggleData' as const

  async execute(args: RpcExecuteArgs<'RenderMultiWiggleData'>) {
    const { executeRenderMultiWiggleData } =
      await import('./executeRenderMultiWiggleData.ts')
    return executeRenderMultiWiggleData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
