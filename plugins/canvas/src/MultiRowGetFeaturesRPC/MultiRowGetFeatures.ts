import RpcMethodTypeWithRenameRegion from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegion'

import type { RegionTooLargeResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { MultiRowGetFeaturesResult } from './rpcTypes.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { RpcResult } from '@jbrowse/core/util/librpc'

export default class MultiRowGetFeatures extends RpcMethodTypeWithRenameRegion<
  'MultiRowGetFeatures',
  RpcResult<MultiRowGetFeaturesResult> | RegionTooLargeResult
> {
  name = 'MultiRowGetFeatures' as const

  async execute(args: RpcExecuteArgs<'MultiRowGetFeatures'>) {
    const { executeMultiRowGetFeatures } =
      await import('./executeMultiRowGetFeatures.ts')
    return executeMultiRowGetFeatures({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
