import RpcMethodTypeWithRenameRegion from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegion'

import type { RenderFeatureDataArgs } from './rpcTypes.ts'

export default class RenderFeatureData extends RpcMethodTypeWithRenameRegion<'RenderFeatureData'> {
  name = 'RenderFeatureData' as const

  async execute(args: RenderFeatureDataArgs, rpcDriverClassName: string) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { executeRenderFeatureData } =
      await import('./executeRenderFeatureData.ts')
    return executeRenderFeatureData({
      pluginManager: this.pluginManager,
      args: deserializedArgs,
    })
  }
}
