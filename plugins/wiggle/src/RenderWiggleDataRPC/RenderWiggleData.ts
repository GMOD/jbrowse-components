import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'

import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Region } from '@jbrowse/core/util'
import type { WiggleDataResult } from '@jbrowse/wiggle-core'

interface RenderWiggleDataArgs {
  adapterConfig: Record<string, unknown>
  // All visible regions in one call so the adapter can coalesce reads across
  // them (BigWig). Returns one WiggleDataResult per region, in input order.
  regions: Region[]
  useBicolor?: boolean
  bicolorPivot?: number
  bpPerPx?: number
  resolution?: number
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    RenderWiggleData: {
      args: RenderWiggleDataArgs
      return: WiggleDataResult[]
    }
  }
}

export default class RenderWiggleData extends RpcMethodTypeWithRenameRegions<'RenderWiggleData'> {
  name = 'RenderWiggleData' as const

  async execute(args: RpcExecuteArgs<'RenderWiggleData'>) {
    const { executeRenderWiggleData } =
      await import('./executeRenderWiggleData.ts')
    return executeRenderWiggleData({
      pluginManager: this.pluginManager,
      args: args,
    })
  }
}
