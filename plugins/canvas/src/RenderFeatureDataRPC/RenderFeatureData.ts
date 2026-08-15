import RpcMethodTypeWithRenameRegion from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegion'

import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

export default class RenderFeatureData extends RpcMethodTypeWithRenameRegion<'RenderFeatureData'> {
  name = 'RenderFeatureData' as const

  async execute(args: RpcExecuteArgs<'RenderFeatureData'>) {
    const { executeRenderFeatureData } =
      await import('./executeRenderFeatureData.ts')
    return executeRenderFeatureData({
      pluginManager: this.pluginManager,
      args: args,
    })
  }
}
