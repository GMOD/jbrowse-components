import RpcMethodTypeWithRenameRegion from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegion'

import type { FeatureDataResult, RegionTooLargeResult } from './rpcTypes.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { RpcResult } from '@jbrowse/core/util/librpc'

export default class RenderFeatureData extends RpcMethodTypeWithRenameRegion<
  'RenderFeatureData',
  RpcResult<FeatureDataResult> | RegionTooLargeResult
> {
  name = 'RenderFeatureData' as const

  async execute(args: RpcExecuteArgs<'RenderFeatureData'>) {
    const { executeRenderFeatureData } =
      await import('./executeRenderFeatureData.ts')
    return executeRenderFeatureData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
