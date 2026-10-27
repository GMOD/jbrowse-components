import RpcMethodTypeWithRenameRegion from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegion'

import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

export default class RenderFeatureData extends RpcMethodTypeWithRenameRegion<'RenderFeatureData'> {
  name = 'RenderFeatureData' as const

  override preload() {
    return import('./executeRenderFeatureData.ts')
  }

  async execute(args: RpcExecuteArgs<'RenderFeatureData'>) {
    const { executeRenderFeatureData } = await this.preload()
    return executeRenderFeatureData({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
