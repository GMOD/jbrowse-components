import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'

import type { LDMetric } from './ldTypes.ts'
import type { LDDataResult } from './types.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Region } from '@jbrowse/core/util'

export interface RenderLDDataArgs {
  adapterConfig: Record<string, unknown>
  regions: Region[]
  /** axis bp of the first block, echoed so a stale payload stays placed */
  originBp: number
  /** axis bp from `originBp` to the far edge of the last block */
  spanBp: number
  ldMetric: LDMetric
  useGenomicPositions: boolean
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    RenderLDData: {
      args: RenderLDDataArgs
      return: LDDataResult
      // Every buffer in the result is allocated per call, so the transfer
      // detaches nothing the worker keeps.
      transferables: LDDataResult
    }
  }
}

export default class RenderLDData extends RpcMethodTypeWithRenameRegions<'RenderLDData'> {
  name = 'RenderLDData' as const

  override preload() {
    return import('./executeRenderLDData.ts')
  }

  async execute(args: RpcExecuteArgs<'RenderLDData'>) {
    const { executeRenderLDData } = await this.preload()
    return executeRenderLDData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
