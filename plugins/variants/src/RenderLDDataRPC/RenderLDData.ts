import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'

import type { LDLayout, LDMetric } from './ldTypes.ts'
import type { LDDataResult } from './types.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type {
  GatedFetchArgs,
  RegionTooLargeResult,
} from '@jbrowse/core/rpc/byteBudget'
import type { Region } from '@jbrowse/core/util'

export interface RenderLDDataArgs extends GatedFetchArgs {
  adapterConfig: Record<string, unknown>
  regions: Region[]
  /** axis bp of the first block, echoed so a stale payload stays placed */
  originBp: number
  /** axis bp from `originBp` to the far edge of the last block */
  spanBp: number
  /** `encoding.color.field`, the statistic the cells are */
  field: LDMetric
  /** `variantLayout`, which a multi-region view answers with columns */
  layout: LDLayout
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    RenderLDData: {
      args: RenderLDDataArgs
      return: LDDataResult | RegionTooLargeResult
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
    const { measureLDRegionBytes } = await import('./measureLDRegionBytes.ts')
    const { bytes, tooLarge } = await measureLDRegionBytes({
      pluginManager: this.pluginManager,
      args,
    })
    const { executeRenderLDData } = await this.preload()
    return tooLarge === undefined
      ? executeRenderLDData({ pluginManager: this.pluginManager, args, bytes })
      : tooLarge
  }
}
